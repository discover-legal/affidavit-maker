'use strict';

/**
 * DocumentSelectionAgent
 *
 * Determines which legal documents a user needs based on their collected
 * interview answers, state, and practice area — without the user ever
 * having to know which forms exist or which apply to their situation.
 *
 * ── Architecture ──────────────────────────────────────────────────────────────
 *
 * This is a stateless, singleton service. Any interview orchestrator (TX, CA,
 * FL, ...) calls:
 *
 *   const { requiredDocuments } = documentSelectionAgent.select(data);
 *
 * The agent routes to the appropriate state+practice-area handler via a
 * registry. Handlers are pure functions:
 *
 *   (data) → { documents: string[], reasons: Object }
 *
 * ── Extending for new states ───────────────────────────────────────────────────
 *
 *   1. Add a handler function at the bottom of this file, e.g. _selectCA_family
 *   2. Register it in the HANDLERS map: 'CA:family' → _selectCA_family
 *   3. Done — any CA orchestrator automatically benefits
 *
 * ── Future: LLM-augmented selection ──────────────────────────────────────────
 *
 * For jurisdictions with more complex rules (e.g. community property edge
 * cases, covenant marriages in AZ, etc.) a handler can call the LLM with
 * a compact prompt + the collected data and return its document list. The
 * interface stays the same; callers don't need to change.
 *
 * ── Reasons object ────────────────────────────────────────────────────────────
 *
 * Each returned document type is accompanied by a short plain-English reason
 * that can be surfaced in the UI ("We're including a Military Status Affidavit
 * because we couldn't confirm whether your spouse is on active duty.").
 */

const logger = require('../../utils/logger');

// ─── Handler registry ─────────────────────────────────────────────────────────
// key: 'STATE:practiceArea'  value: handler function
// Wildcard '*' is used as a fallback when no state-specific handler exists.

const HANDLERS = {};

// ─── Texas – Family Law ────────────────────────────────────────────────────────

/**
 * Texas family-law divorce document selection.
 *
 * Follows the Texas Supreme Court Divorce Set 1 packet logic:
 * https://www.txcourts.gov/programs-services/self-help/divorce/
 *
 * Core documents:
 *   divorce_petition        — always (initiates the case)
 *   divorce_decree          — always (final order dissolving marriage)
 *
 * Conditional supporting documents:
 *   waiver_of_service       — spouse agreed to sign (cooperative divorce)
 *   prove_up_affidavit      — agreed divorce → skip courthouse hearing
 *   cert_last_known_address — respondent hasn't appeared / can't be located
 *   military_status_affidavit — respondent hasn't appeared OR military status uncertain
 *   indigency_affidavit     — user requests filing fee waiver
 */
function selectTX_family(data) {
  const docs = [];
  const reasons = {};

  // ── Core ──
  docs.push('divorce_petition');
  reasons['divorce_petition'] = 'Required to open your divorce case with the court.';

  docs.push('divorce_decree');
  reasons['divorce_decree'] = 'The final court order that officially ends the marriage.';

  // ── Service path ──
  if (data.serviceMethod === 'waiver') {
    // Agreed divorce — spouse is cooperative and will sign
    docs.push('waiver_of_service');
    reasons['waiver_of_service'] =
      'Your spouse agreed to waive formal service, which avoids the cost and delay of a process server.';

    docs.push('prove_up_affidavit');
    reasons['prove_up_affidavit'] =
      'Since both parties agree on all terms, this sworn statement lets the judge approve your divorce without requiring you to appear in court.';

    // Military status still needed if not confirmed non-military
    if (data.respondentMilitaryStatus && data.respondentMilitaryStatus !== 'not_military') {
      docs.push('military_status_affidavit');
      reasons['military_status_affidavit'] =
        'Even in an agreed divorce, the court needs confirmation of your spouse\'s military status before finalizing.';
    }

  } else if (data.serviceMethod) {
    // Formal service or last-known-address — respondent hasn't appeared
    docs.push('cert_last_known_address');
    reasons['cert_last_known_address'] =
      'Since your spouse hasn\'t signed a waiver, you\'ll need to certify their last known address so the court can verify service was attempted.';

    docs.push('military_status_affidavit');
    reasons['military_status_affidavit'] =
      'Federal law (SCRA) requires confirming whether your spouse is on active military duty before the court can enter a default judgment.';
  }
  // If service method not yet collected, only core docs shown (interview still in progress)

  // ── Fee waiver ──
  if (data.indigencyRequested === true) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] =
      'Your Statement of Inability to Afford Court Costs will allow the court to waive the ~$300–400 filing fee.';
  }

  return { documents: docs, reasons };
}

HANDLERS['TX:family'] = selectTX_family;

// ─── Fallback — generic affidavit ─────────────────────────────────────────────

/**
 * Fallback for states/practice-areas that don't yet have a dedicated handler.
 * Returns a single general affidavit.
 */
function selectDefault(data) {
  return {
    documents: ['affidavit'],
    reasons: { affidavit: 'A general-purpose affidavit for your state and situation.' }
  };
}

HANDLERS['*:family']  = selectDefault;
HANDLERS['*:general'] = selectDefault;

// ─── DocumentSelectionAgent class ─────────────────────────────────────────────

class DocumentSelectionAgent {
  /**
   * Determine which documents this user needs.
   *
   * @param {Object} data         - Collected interview data (from any orchestrator)
   * @param {string} practiceArea - 'family' | 'civil' | 'general'
   * @returns {{ requiredDocuments: string[], selectionReasons: Object }}
   */
  select(data, practiceArea) {
    const state    = (data.state || 'TX').toUpperCase();
    const area     = practiceArea || data.practiceArea || 'family';
    const key      = `${state}:${area}`;
    const handler  = HANDLERS[key] || HANDLERS[`*:${area}`] || selectDefault;

    logger.debug('DocumentSelectionAgent: selecting documents', { state, area, handler: handler.name });

    const { documents, reasons } = handler(data);

    return {
      requiredDocuments: documents,
      selectionReasons:  reasons   // can be surfaced in UI tooltips / review screen
    };
  }

  /**
   * Register a custom handler at runtime (for plugins or testing).
   *
   * @param {string}   stateCode    - 2-letter state code or '*' for wildcard
   * @param {string}   practiceArea - 'family' | 'civil' | etc.
   * @param {Function} handlerFn    - (data) => { documents, reasons }
   */
  registerHandler(stateCode, practiceArea, handlerFn) {
    const key = `${stateCode.toUpperCase()}:${practiceArea}`;
    HANDLERS[key] = handlerFn;
    logger.info('DocumentSelectionAgent: registered handler', { key });
  }

  /**
   * List all registered state+practice-area combinations.
   * Useful for the /api/templates/states endpoint.
   */
  listHandlers() {
    return Object.keys(HANDLERS).filter(k => !k.startsWith('*'));
  }
}

module.exports = new DocumentSelectionAgent();
