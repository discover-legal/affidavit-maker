'use strict';

/**
 * AffidavitRequirementsChecker
 *
 * Symbolically evaluates the current conversation state against the formal
 * requirements for an affidavit type.  No LLM involved — pure deterministic
 * logic.
 *
 * This is the "symbolic" half of the neurosymbolic fact-collection loop:
 *
 *   LLM (neural)  — conversationally elicits facts from the user
 *   Checker (symbolic) — determines which requirements are satisfied / missing
 *                        and gates phase advancement
 *
 * Usage
 * ─────
 *   const checker = require('./AffidavitRequirementsChecker');
 *   const result  = checker.check('affidavit_of_residency', data, facts);
 *   // result.isComplete → Boolean
 *   // result.missing    → Topic[] that must still be covered
 *   // result.satisfied  → Topic[] that are already covered
 *   // result.completeness → 0.0 – 1.0 progress ratio
 *
 * Satisfaction logic
 * ──────────────────
 * A topic is satisfied when at least one fact's `.category` OR `.content`
 * contains any of the topic's `categories` strings (case-insensitive substring
 * match).  This is intentionally loose — we trust the LLM extracted the fact
 * under a reasonable category label.
 *
 * A structured field is satisfied when `data[fieldId]` is non-empty.
 *
 * Phase completion requires ALL of:
 *   1. Every requiredTopic satisfied
 *   2. Every structuredField present in data
 *   3. Total fact count >= minimumFacts
 */

const REQUIREMENTS = require('../affidavits/requirements/index');

class AffidavitRequirementsChecker {

  /**
   * Evaluate data + facts against requirements for the given type.
   *
   * @param {string} typeId  - affidavit type id (e.g. 'affidavit_of_residency')
   * @param {object} data    - current affidavitData object
   * @param {Array}  facts   - current facts array (each has .category, .content)
   * @returns {CheckResult}
   */
  check(typeId, data, facts = []) {
    const req = REQUIREMENTS[typeId] || REQUIREMENTS['general_affidavit'];

    const satisfiedTopics = [];
    const missingTopics   = [];

    // ── Structured fields ──────────────────────────────────────────────────────
    const satisfiedFields = [];
    const missingFields   = [];

    for (const fieldId of (req.structuredFields || [])) {
      const val = data[fieldId];
      if (val && String(val).trim().length > 0) {
        satisfiedFields.push(fieldId);
      } else {
        missingFields.push(fieldId);
      }
    }

    // ── Required topics ────────────────────────────────────────────────────────
    for (const topic of (req.requiredTopics || [])) {
      if (this._topicSatisfied(topic, facts)) {
        satisfiedTopics.push(topic);
      } else {
        missingTopics.push(topic);
      }
    }

    // ── Completeness ───────────────────────────────────────────────────────────
    const totalItems     = (req.structuredFields?.length || 0) + (req.requiredTopics?.length || 0);
    const satisfiedCount = satisfiedFields.length + satisfiedTopics.length;
    const completeness   = totalItems > 0 ? satisfiedCount / totalItems : 1.0;

    const hasEnoughFacts = (facts.length >= (req.minimumFacts || 1));
    const isComplete     = missingTopics.length === 0
                        && missingFields.length === 0
                        && hasEnoughFacts;

    return {
      typeId,
      displayName:     req.displayName,
      isComplete,
      completeness,
      satisfiedTopics,
      missingTopics,
      satisfiedFields,
      missingFields,
      factCount:       facts.length,
      minimumFacts:    req.minimumFacts || 1,
      hasEnoughFacts,
    };
  }

  /**
   * Format missing topics as a concise bullet list for injection into the
   * LLM prompt.  When nothing is missing, returns a completion signal.
   *
   * @param {CheckResult} result
   * @returns {string}
   */
  formatMissingForPrompt(result) {
    const lines = [];

    if (result.missingFields.length > 0) {
      lines.push('STRUCTURED FIELDS STILL NEEDED:');
      result.missingFields.forEach(f => lines.push(`  • ${f}`));
    }

    if (result.missingTopics.length > 0) {
      lines.push('TOPICS STILL TO COVER:');
      result.missingTopics.forEach(t => {
        lines.push(`  • ${t.label}`);
        if (t.hint) lines.push(`    → ${t.hint}`);
      });
    }

    if (!result.hasEnoughFacts && result.isComplete === false) {
      lines.push(`MINIMUM FACTS: at least ${result.minimumFacts} fact(s) required (${result.factCount} collected so far)`);
    }

    if (lines.length === 0) {
      return 'All required topics have been covered. You may set phase_complete: true.';
    }

    return lines.join('\n');
  }

  /**
   * Format satisfied topics as a summary — useful for REVIEW phase and
   * debug logging.
   *
   * @param {CheckResult} result
   * @returns {string}
   */
  formatSatisfiedForPrompt(result) {
    if (result.satisfiedTopics.length === 0 && result.satisfiedFields.length === 0) {
      return 'No topics covered yet.';
    }
    const lines = ['ALREADY COVERED:'];
    result.satisfiedFields.forEach(f  => lines.push(`  ✓ ${f} (structured field)`));
    result.satisfiedTopics.forEach(t  => lines.push(`  ✓ ${t.label}`));
    return lines.join('\n');
  }

  /**
   * Get the raw requirements spec for a type.
   * @param {string} typeId
   * @returns {object}
   */
  getRequirements(typeId) {
    return REQUIREMENTS[typeId] || REQUIREMENTS['general_affidavit'];
  }

  /**
   * List all known type IDs.
   * @returns {string[]}
   */
  listTypes() {
    return Object.keys(REQUIREMENTS);
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * A topic is satisfied if ANY fact covers it.
   * Matching is a case-insensitive substring check on fact.category OR fact.content.
   */
  _topicSatisfied(topic, facts) {
    return facts.some(fact => {
      const category = (fact.category    || '').toLowerCase();
      const content  = (fact.content     || '').toLowerCase();
      const sub      = (fact.subcategory || '').toLowerCase();

      return topic.categories.some(c => {
        const needle = c.toLowerCase();
        return category.includes(needle)
            || content.includes(needle)
            || sub.includes(needle);
      });
    });
  }
}

module.exports = new AffidavitRequirementsChecker();
