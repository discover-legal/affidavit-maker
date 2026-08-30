// templates/core/spousalSupport.js
// Truthful spousal-support outcome resolution shared by decree base and
// state overrides.
//
// The live audits caught a contested $1,800/mo award being rendered as a
// mutual waiver because the decree only checked `spousalSupportWaived`
// (falsy) OR `spousalSupportAwarded` (also falsy — the orchestrator had
// only recorded `requestSpousalSupport: true` + `spousalSupportAmount`).
// The correct precedence:
//
//   1. An affirmative request-and-amount pair renders an AWARD, even when
//      no explicit `spousalSupportAwarded` flag was set.
//   2. An affirmative waiver (either party said "we're waiving") renders
//      the mutual-waiver order.
//   3. If the data disagrees with itself (a request AND a waiver flag both
//      truthy), request wins — a false waiver against a party asking for
//      support is a defective order, whereas a "reserve" clause is safe.
//   4. When neither branch fires the caller returns `null` (no section),
//      preserving the historical no-section behavior for empty data.
//
// The optional 'reserve' outcome is available for callers that want to
// emit an honest reservation of jurisdiction (recommended when a request
// was made but no amount is on file — the court then sets an amount).

'use strict';

/**
 * @param {Object} divorceData - Saved case data
 * @returns {{outcome: 'award'|'waive'|'reserve'|'none',
 *            payor: string|null, payee: string|null,
 *            amount: string|null, duration: string|null,
 *            startDate: string|null}}
 */
function resolveSpousalSupportDecision(divorceData) {
  const d = divorceData || {};

  const requested =
    d.requestSpousalSupport === true ||
    d.spousalSupportRequested === true;
  const waivedFlag =
    d.spousalSupportWaived === true ||
    (d.spousalSupportRequested === false && !requested);
  const awarded =
    d.spousalSupportAwarded === true ||
    (requested && (d.spousalSupportAmount != null && String(d.spousalSupportAmount).trim() !== ''));

  const payor =
    (d.spousalSupportPayor && String(d.spousalSupportPayor).trim()) ||
    (d.respondentName && String(d.respondentName).trim()) ||
    null;
  const payee =
    (d.spousalSupportPayee && String(d.spousalSupportPayee).trim()) ||
    (d.petitionerName && String(d.petitionerName).trim()) ||
    null;
  const amount = d.spousalSupportAmount != null && String(d.spousalSupportAmount).trim() !== ''
    ? String(d.spousalSupportAmount)
    : null;
  const duration = d.spousalSupportDuration != null && String(d.spousalSupportDuration).trim() !== ''
    ? String(d.spousalSupportDuration)
    : null;
  const startDate = d.spousalSupportStartDate || null;

  // Precedence: an affirmative award (or a request with an amount) beats
  // any waiver flag. A false waiver against a party who asked is defective.
  if (awarded) {
    return { outcome: 'award', payor, payee, amount, duration, startDate };
  }

  // A request with no amount recorded — plead an honest reservation rather
  // than a false waiver. The court sets the amount at hearing.
  if (requested && !amount) {
    return { outcome: 'reserve', payor, payee, amount: null, duration: null, startDate: null };
  }

  if (waivedFlag) {
    return { outcome: 'waive', payor, payee, amount, duration, startDate };
  }

  return { outcome: 'none', payor, payee, amount, duration, startDate };
}

module.exports = { resolveSpousalSupportDecision };
