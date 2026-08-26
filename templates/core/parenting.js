// templates/core/parenting.js
// Custody/parenting enum normalization shared by the divorce petition and
// decree base classes (and their jurisdiction subclasses).
//
// The interview orchestrators store machine-reliable enums on the case data:
//   custodyType: 'joint' | 'sole_petitioner' | 'sole_respondent' | 'shared'
//              | 'split' | 'contested' | 'undecided'
//   primaryResidence / primaryCustodian: who the children primarily live with
//
// Older saved documents carry free-text values ("joint decision making",
// "sole custody to mother", …). The safety rule that motivates this module:
// NEVER let an unrecognized value fall through to a sole-custody order — a
// wrong-but-plausible order is worse than neutral as-agreed language. So the
// normalizer only maps values it can positively recognize, and everything
// else becomes 'unspecified', which templates render as a neutral parenting
// order with an explicit placeholder plus a validation warning.

'use strict';

/**
 * Normalize the stored custody arrangement.
 *
 * @param {Object} divorceData - The saved case data
 * @returns {{kind: 'joint'|'sole_petitioner'|'sole_respondent'|'legacy_sole'|'unspecified',
 *            raw: string|null, explicit: boolean}}
 *   kind        - safe rendering branch
 *   raw         - the stored value (null when absent)
 *   explicit    - false when custodyType was absent and 'joint' is only the
 *                 historical default (petitions must not plead a defaulted
 *                 arrangement as if the parties chose it)
 */
function resolveCustodyArrangement(divorceData) {
  const raw = divorceData && divorceData.custodyType != null && String(divorceData.custodyType).trim() !== ''
    ? String(divorceData.custodyType).trim()
    : null;

  if (raw === null) {
    // Historical default: templates always rendered the joint branch when no
    // custody type was stored. Preserved for byte-identity of old US output.
    return { kind: 'joint', raw: null, explicit: false };
  }

  const value = raw.toLowerCase();

  // Machine enums (exact).
  if (value === 'joint' || value === 'shared') {
    return { kind: 'joint', raw, explicit: true };
  }
  if (value === 'sole_petitioner') {
    return { kind: 'sole_petitioner', raw, explicit: true };
  }
  if (value === 'sole_respondent') {
    return { kind: 'sole_respondent', raw, explicit: true };
  }
  if (value === 'split' || value === 'contested' || value === 'undecided') {
    return { kind: 'unspecified', raw, explicit: true };
  }

  // Legacy exact 'sole': the old else-branch was the deliberate rendering for
  // this stored value (sole to primaryCustodian, falling back to the filer).
  if (value === 'sole') {
    return { kind: 'legacy_sole', raw, explicit: true };
  }

  // Legacy free text that positively indicates a shared arrangement
  // ("joint decision making", "shared parenting", "joint custody", …).
  if (/\b(joint|shared)\b/.test(value)) {
    return { kind: 'joint', raw, explicit: true };
  }

  // Anything else ("sole custody to mother", junk, …) is ambiguous — render
  // neutral, never a sole order.
  return { kind: 'unspecified', raw, explicit: true };
}

/**
 * Resolve the name of the person the children primarily reside with, from
 * primaryResidence / primaryCustodian. Accepts either a party name or a
 * party-role token ('petitioner' / 'applicant' / 'respondent').
 *
 * @param {Object} divorceData - The saved case data
 * @returns {string|null} A display name, or null when no residence data exists
 */
function resolvePrimaryResidenceName(divorceData) {
  const raw = (divorceData && (divorceData.primaryResidence || divorceData.primaryCustodian)) || null;
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;

  const role = value.toLowerCase();
  if (role === 'petitioner' || role === 'applicant' || role === 'filer') {
    return (divorceData.petitionerName && String(divorceData.petitionerName).trim()) || null;
  }
  if (role === 'respondent') {
    return (divorceData.respondentName && String(divorceData.respondentName).trim()) || null;
  }
  return value;
}

module.exports = {
  resolveCustodyArrangement,
  resolvePrimaryResidenceName,
};
