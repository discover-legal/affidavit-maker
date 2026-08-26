'use strict';

/**
 * Shape tolerance for interview data reaching templates.
 *
 * The extraction layer stores some fields as free strings ("Assets the
 * petitioner keeps, as a comma-separated description, in the user's
 * words" — services/agents/BaseDivorceOrchestrator.js), while older saves
 * and some code paths carry arrays. Templates must render both without
 * crashing (`.forEach` on a string) or silently dropping (Array.isArray
 * guards that skip strings).
 *
 * A string is deliberately kept as ONE list item — never split on commas
 * or otherwise re-parsed: the user's description stays whole ("the house
 * at 12 Main St, Ottawa" is one asset, not two).
 */
function asList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

module.exports = { asList };
