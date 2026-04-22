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

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * True when the interview has confirmed minor children exist.
 *
 * childrenConfirmed semantics (from tool definition):
 *   true  = CHILDREN phase is complete (either "no minor children" confirmed,
 *            OR children data was collected and the section is done)
 *   false/undefined = CHILDREN phase not yet completed
 *
 * The LLM populates the children array when children exist AND sets
 * childrenConfirmed: true when the phase is done. The primary signal is
 * whether the children array has entries. hasMinorChildren is never set by
 * FIELD_MAP so we never rely on it.
 */
function hasChildren(data) {
  return (data.children?.length > 0);
}

/**
 * True when a military-status affidavit is needed on the WAIVER path.
 * Even in an agreed divorce the court needs military confirmation if status
 * isn't affirmatively confirmed as not_military (SCRA is federal, applies everywhere).
 */
function needsMilitaryOnWaiverPath(data) {
  return data.respondentMilitaryStatus && data.respondentMilitaryStatus !== 'not_military';
}

// ─── Texas – Family Law ────────────────────────────────────────────────────────

/**
 * Texas family-law divorce document selection.
 * Follows TX Supreme Court Divorce Set 1: txcourts.gov/programs-services/self-help/divorce/
 * TX decree absorbs the Standard Possession Order & child support provisions internally,
 * so no separate parenting_plan document is needed for uncontested TX divorces.
 */
function selectTX_family(data) {
  const docs = [];
  const reasons = {};

  docs.push('divorce_petition');
  reasons['divorce_petition'] = 'Required to open your divorce case with the court.';

  docs.push('divorce_decree');
  reasons['divorce_decree'] = 'The final court order that officially ends the marriage.';

  if (data.serviceMethod === 'waiver') {
    docs.push('waiver_of_service');
    reasons['waiver_of_service'] =
      'Your spouse agreed to waive formal service, which avoids the cost and delay of a process server.';

    docs.push('prove_up_affidavit');
    reasons['prove_up_affidavit'] =
      'Since both parties agree on all terms, this sworn statement lets the judge approve your divorce without requiring you to appear in court.';

    if (needsMilitaryOnWaiverPath(data)) {
      docs.push('military_status_affidavit');
      reasons['military_status_affidavit'] =
        'Even in an agreed divorce, the court needs confirmation of your spouse\'s military status before finalizing.';
    }

  } else if (data.serviceMethod) {
    docs.push('cert_last_known_address');
    reasons['cert_last_known_address'] =
      'Since your spouse hasn\'t signed a waiver, you\'ll need to certify their last known address so the court can verify service was attempted.';

    docs.push('military_status_affidavit');
    reasons['military_status_affidavit'] =
      'Federal law (SCRA) requires confirming whether your spouse is on active military duty before the court can enter a default judgment.';
  }

  if (data.indigencyRequested === true) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] =
      'Your Statement of Inability to Afford Court Costs will allow the court to waive the ~$300–400 filing fee.';
  }

  return { documents: docs, reasons };
}

HANDLERS['TX:family'] = selectTX_family;

// ─── Arizona – Family Law ──────────────────────────────────────────────────────

function selectAZ_family(data) {
  const docs = [];
  const reasons = {};

  docs.push('divorce_petition');
  reasons['divorce_petition'] = 'Required to open your dissolution of marriage case in Arizona Superior Court.';

  docs.push('divorce_decree');
  reasons['divorce_decree'] = 'The final court decree dissolving the marriage and resolving all issues.';

  if (hasChildren(data)) {
    docs.push('parenting_plan');
    reasons['parenting_plan'] = 'Arizona requires a parenting plan specifying legal decision-making and parenting time for each child.';
  }

  if (data.serviceMethod === 'waiver') {
    docs.push('waiver_of_service');
    reasons['waiver_of_service'] = 'Your spouse agreed to voluntarily accept service, which avoids the cost and delay of a process server.';

    if (needsMilitaryOnWaiverPath(data)) {
      docs.push('military_status_affidavit');
      reasons['military_status_affidavit'] = 'Even in an agreed dissolution, the court needs confirmation of your spouse\'s military status (SCRA).';
    }
  } else if (data.serviceMethod) {
    docs.push('cert_last_known_address');
    reasons['cert_last_known_address'] = 'Since your spouse has not signed an acceptance of service, you\'ll need to certify their last known address.';

    docs.push('military_status_affidavit');
    reasons['military_status_affidavit'] = 'Federal law (SCRA) requires confirming your spouse\'s military status before a default judgment can be entered.';
  }

  if (data.indigencyRequested === true) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'Your Application to Defer or Waive Court Fees (Form AOCFD111) will allow the court to waive the filing fee under A.R.S. § 12-302.';
  }

  return { documents: docs, reasons };
}

HANDLERS['AZ:family'] = selectAZ_family;

// ─── California – Family Law ──────────────────────────────────────────────────

function selectCA_family(data) {
  const docs = [];
  const reasons = {};

  docs.push('petition_dissolution');
  reasons['petition_dissolution'] = 'The FL-100 Petition for Dissolution of Marriage is the required opening document for your case.';

  docs.push('judgment_dissolution');
  reasons['judgment_dissolution'] = 'The final Judgment of Dissolution (FL-180/FL-190) officially ends the marriage after the mandatory 6-month waiting period.';

  if (hasChildren(data)) {
    docs.push('child_custody_order');
    reasons['child_custody_order'] = 'A formal child custody and visitation order (FL-341) is required when minor children are involved.';

    docs.push('child_support_order');
    reasons['child_support_order'] = 'California requires a separate Child Support Information and Order Attachment (FL-342) documenting the support calculation.';
  }

  if (data.spousalSupportRequested) {
    docs.push('spousal_support_order');
    reasons['spousal_support_order'] = 'A spousal support order documents the agreed or court-ordered maintenance terms.';
  }

  if (data.serviceMethod === 'waiver') {
    docs.push('acknowledgment_of_receipt');
    reasons['acknowledgment_of_receipt'] = 'Your spouse agreed to sign an Acknowledgment of Receipt of service, which avoids formal service costs.';

    if (needsMilitaryOnWaiverPath(data)) {
      docs.push('military_status_affidavit');
      reasons['military_status_affidavit'] = 'Even with an acknowledgment of service, the court needs military status confirmation (SCRA) before finalizing.';
    }
  } else if (data.serviceMethod) {
    docs.push('military_status_affidavit');
    reasons['military_status_affidavit'] = 'California courts require confirmation of military status (SCRA) before entering a default judgment.';
  }

  if (data.indigencyRequested === true) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'Your Request to Waive Court Fees (FW-001) will allow the court to waive the ~$435–450 filing fee under Cal. Rules of Court, rules 3.50–3.58.';
  }

  return { documents: docs, reasons };
}

HANDLERS['CA:family'] = selectCA_family;

// ─── Florida – Family Law ─────────────────────────────────────────────────────

function selectFL_family(data) {
  const docs = [];
  const reasons = {};

  docs.push('petition_dissolution');
  reasons['petition_dissolution'] = 'The Petition for Dissolution of Marriage is required to open your case in the Circuit Court.';

  docs.push('final_judgment');
  reasons['final_judgment'] = 'The Final Judgment of Dissolution resolves all issues and officially ends the marriage.';

  if (hasChildren(data)) {
    docs.push('parenting_plan');
    reasons['parenting_plan'] = 'Florida requires a Parenting Plan detailing time-sharing and parental responsibility for each child (§ 61.13 F.S.).';

    docs.push('child_support_worksheet');
    reasons['child_support_worksheet'] = 'Florida requires a Child Support Guidelines Worksheet to calculate support under the statutory formula.';
  }

  if (data.serviceMethod === 'waiver') {
    docs.push('waiver_of_service');
    reasons['waiver_of_service'] = 'Your spouse agreed to voluntarily accept service.';

    if (needsMilitaryOnWaiverPath(data)) {
      docs.push('military_status_affidavit');
      reasons['military_status_affidavit'] = 'Even in an agreed dissolution, the court needs military status confirmation (SCRA) before finalizing.';
    }
  } else if (data.serviceMethod) {
    docs.push('military_status_affidavit');
    reasons['military_status_affidavit'] = 'SCRA requires confirming military status before a default judgment can be entered.';
  }

  if (data.indigencyRequested === true) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'Your Application for Determination of Civil Indigent Status will allow the court to waive the ~$400–410 filing fee under § 57.082 F.S.';
  }

  return { documents: docs, reasons };
}

HANDLERS['FL:family'] = selectFL_family;

// ─── Illinois – Family Law ────────────────────────────────────────────────────

function selectIL_family(data) {
  const docs = [];
  const reasons = {};

  docs.push('petition_dissolution');
  reasons['petition_dissolution'] = 'The Petition for Dissolution of Marriage opens your case in the Circuit Court.';

  docs.push('judgment_dissolution');
  reasons['judgment_dissolution'] = 'The Judgment for Dissolution of Marriage (Marital Settlement Agreement or contested order) finalizes the divorce.';

  if (hasChildren(data)) {
    docs.push('parenting_plan');
    reasons['parenting_plan'] = 'Illinois requires an Allocation Judgment specifying parental responsibilities and parenting time (750 ILCS 5/602.10).';

    docs.push('child_support_order');
    reasons['child_support_order'] = 'A Child Support Order is required to document support obligations under Illinois statutory guidelines.';
  }

  if (data.serviceMethod === 'waiver') {
    docs.push('waiver_of_service');
    reasons['waiver_of_service'] = 'Your spouse agreed to voluntarily accept service.';

    if (needsMilitaryOnWaiverPath(data)) {
      docs.push('military_status_affidavit');
      reasons['military_status_affidavit'] = 'Even in an agreed dissolution, the court needs military status confirmation (SCRA) before finalizing.';
    }
  } else if (data.serviceMethod) {
    docs.push('military_status_affidavit');
    reasons['military_status_affidavit'] = 'SCRA requires confirming military status before a default judgment can be entered.';
  }

  if (data.indigencyRequested === true) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'Your Application for Waiver of Court Fees will allow the court to waive the filing fee under 735 ILCS 5/5-105.';
  }

  return { documents: docs, reasons };
}

HANDLERS['IL:family'] = selectIL_family;

// ─── New York – Family Law ────────────────────────────────────────────────────

function selectNY_family(data) {
  const docs = [];
  const reasons = {};

  docs.push('summons_with_notice');
  reasons['summons_with_notice'] = 'New York requires a Summons with Notice to initiate the divorce action in Supreme Court. You\'ll receive an Index Number when you file.';

  docs.push('verified_complaint');
  reasons['verified_complaint'] = 'The Verified Complaint sets out the grounds and relief sought in your divorce action.';

  docs.push('proposed_judgment');
  reasons['proposed_judgment'] = 'A Proposed Judgment of Divorce is required for the court to finalize the divorce and equitable distribution.';

  if (hasChildren(data)) {
    docs.push('parenting_plan');
    reasons['parenting_plan'] = 'A custody and parenting time agreement is required when minor children are involved (DRL § 240).';

    docs.push('child_support_worksheet');
    reasons['child_support_worksheet'] = 'New York requires a Child Support Standards Act (CSSA) worksheet to document the support calculation (FCA § 413).';
  }

  if (data.serviceMethod === 'waiver') {
    docs.push('acknowledgment_of_service');
    reasons['acknowledgment_of_service'] = 'Your spouse agreed to sign an Acknowledgment of Service, which is the fastest way to effect service in New York.';

    if (needsMilitaryOnWaiverPath(data)) {
      docs.push('military_status_affidavit');
      reasons['military_status_affidavit'] = 'Even with an acknowledgment of service, the court needs military status confirmation (SCRA) before finalizing.';
    }
  } else if (data.serviceMethod) {
    docs.push('military_status_affidavit');
    reasons['military_status_affidavit'] = 'SCRA requires confirming military status before a default judgment can be entered.';
  }

  if (data.indigencyRequested === true) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'Your Poor Person affidavit (CPLR § 1101) will allow the court to waive the $210 Index Number fee and other filing costs.';
  }

  return { documents: docs, reasons };
}

HANDLERS['NY:family'] = selectNY_family;

// ─── Utah – Family Law ────────────────────────────────────────────────────────

function selectUT_family(data) {
  const docs = [];
  const reasons = {};

  docs.push('divorce_petition');
  reasons['divorce_petition'] = 'Required to open your divorce case in Utah District Court.';

  docs.push('divorce_decree');
  reasons['divorce_decree'] = 'The Decree of Divorce is the final court order dissolving the marriage.';

  if (hasChildren(data)) {
    docs.push('parenting_plan');
    reasons['parenting_plan'] = 'Utah requires a Parenting Plan filed with the court specifying custody and parent-time for each child (Utah Code § 81-9-201).';
  }

  if (data.serviceMethod === 'waiver') {
    docs.push('waiver_of_service');
    reasons['waiver_of_service'] = 'Your spouse agreed to waive formal service, which saves time and cost.';

    docs.push('prove_up_affidavit');
    reasons['prove_up_affidavit'] = 'In an agreed Utah divorce, this sworn statement allows the judge to approve the divorce without a court appearance.';

    if (needsMilitaryOnWaiverPath(data)) {
      docs.push('military_status_affidavit');
      reasons['military_status_affidavit'] = 'The court needs confirmation of your spouse\'s military status even in an agreed divorce (SCRA).';
    }
  } else if (data.serviceMethod) {
    docs.push('cert_last_known_address');
    reasons['cert_last_known_address'] = 'Since your spouse hasn\'t signed a waiver, you\'ll need to certify their last known address.';

    docs.push('military_status_affidavit');
    reasons['military_status_affidavit'] = 'Federal law (SCRA) requires confirming your spouse\'s military status before a default judgment can be entered.';
  }

  if (data.indigencyRequested === true) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'Your Motion to Waive Fees will allow the court to waive the filing fee based on financial hardship (Utah Code of Judicial Administration Rule 4-202.02).';
  }

  return { documents: docs, reasons };
}

HANDLERS['UT:family'] = selectUT_family;

// ─── Family Law Matter Types ──────────────────────────────────────────────────

// Custody
HANDLERS['*:custody'] = function(data) {
  const docs = [];
  const reasons = {};

  docs.push('petition_for_custody');
  reasons['petition_for_custody'] = 'A petition to establish or modify custody and visitation arrangements.';

  if (data.custodyTypeRequested === 'modification') {
    docs.push('motion_to_modify_custody');
    reasons['motion_to_modify_custody'] = 'A motion to modify an existing custody order based on changed circumstances.';
  }

  if (data.proposedSchedule) {
    docs.push('parenting_plan');
    reasons['parenting_plan'] = 'A detailed parenting plan specifying the custody schedule and decision-making responsibilities.';
  }

  if (data.safetyConcernsConfirmed) {
    docs.push('declaration_in_support');
    reasons['declaration_in_support'] = 'A sworn declaration documenting safety concerns that support your custody request.';
  }

  if (data.indigencyRequested) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'A fee waiver request based on financial hardship.';
  }

  return { documents: docs, reasons };
};

// Child Support
HANDLERS['*:child_support'] = function(data) {
  const docs = [];
  const reasons = {};

  if (data.isModification) {
    docs.push('motion_to_modify_support');
    reasons['motion_to_modify_support'] = 'A motion to modify an existing child support order based on changed circumstances.';
  } else {
    docs.push('petition_for_child_support');
    reasons['petition_for_child_support'] = 'A petition to establish a child support order.';
  }

  docs.push('financial_declaration');
  reasons['financial_declaration'] = 'A sworn financial disclosure required by the court to calculate support under state guidelines.';

  if (data.arrearsAmount > 0) {
    docs.push('motion_for_arrears');
    reasons['motion_for_arrears'] = 'A motion to collect unpaid child support arrears.';
  }

  if (data.indigencyRequested) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'A fee waiver request based on financial hardship.';
  }

  return { documents: docs, reasons };
};

// DVRO (Domestic Violence Restraining Order)
HANDLERS['*:dvro'] = function(data) {
  const docs = [];
  const reasons = {};

  if (data.wantsTro) {
    docs.push('request_for_tro');
    reasons['request_for_tro'] = 'An emergency Temporary Restraining Order for immediate protection — typically granted the same day.';
  }

  docs.push('petition_for_dvro');
  reasons['petition_for_dvro'] = 'A Domestic Violence Restraining Order petition for ongoing protection.';

  docs.push('dv_declaration');
  reasons['dv_declaration'] = 'A sworn declaration describing the incidents of domestic violence that support your request for protection.';

  if (hasChildren(data)) {
    docs.push('child_custody_dv_order');
    reasons['child_custody_dv_order'] = 'A custody and visitation order to protect children and establish safe arrangements.';
  }

  return { documents: docs, reasons };
};

// Paternity
HANDLERS['*:paternity'] = function(data) {
  const docs = [];
  const reasons = {};

  if (data.actionType === 'establish') {
    docs.push('petition_to_establish_paternity');
    reasons['petition_to_establish_paternity'] = 'A petition to legally establish parentage.';

    if (data.onBirthCertificate === false) {
      docs.push('motion_to_amend_birth_certificate');
      reasons['motion_to_amend_birth_certificate'] = 'A motion to add the father\'s name to the birth certificate once paternity is established.';
    }
  } else if (data.actionType === 'disestablish') {
    docs.push('petition_to_disestablish_paternity');
    reasons['petition_to_disestablish_paternity'] = 'A petition to remove a man\'s legal paternity when DNA evidence shows he is not the biological father.';
  }

  if (data.reliefRequested && data.reliefRequested.includes('support')) {
    docs.push('petition_for_child_support');
    reasons['petition_for_child_support'] = 'A child support order is being sought along with paternity establishment.';
  }

  return { documents: docs, reasons };
};

// Legal Separation
HANDLERS['*:legal_separation'] = function(data) {
  const docs = [];
  const reasons = {};

  docs.push('petition_for_legal_separation');
  reasons['petition_for_legal_separation'] = 'A petition to legally separate while remaining married.';

  docs.push('separation_agreement');
  reasons['separation_agreement'] = 'A marital separation agreement documenting terms for living separately.';

  if (hasChildren(data)) {
    docs.push('parenting_plan');
    reasons['parenting_plan'] = 'A parenting plan establishing custody and visitation during the separation.';
  }

  if (data.spousalSupportRequested) {
    docs.push('spousal_support_order');
    reasons['spousal_support_order'] = 'A temporary spousal support order during the separation period.';
  }

  if (data.serviceMethod === 'waiver') {
    docs.push('waiver_of_service');
    reasons['waiver_of_service'] = 'Your spouse agreed to voluntarily accept service of the separation papers.';
  }

  return { documents: docs, reasons };
};

// Annulment
HANDLERS['*:annulment'] = function(data) {
  const docs = [];
  const reasons = {};

  docs.push('petition_for_annulment');
  reasons['petition_for_annulment'] = 'A petition to declare the marriage void or voidable based on legal grounds.';

  docs.push('declaration_supporting_annulment');
  reasons['declaration_supporting_annulment'] = 'A sworn declaration detailing the specific grounds (fraud, bigamy, incapacity, etc.) that justify annulment.';

  if (data.childrenOfMarriage) {
    docs.push('custody_order');
    reasons['custody_order'] = 'Even in an annulled marriage, children are legitimate and a custody order is required.';
  }

  return { documents: docs, reasons };
};

// Guardianship of Minor
HANDLERS['*:guardianship_minor'] = function(data) {
  const docs = [];
  const reasons = {};

  docs.push('petition_for_guardianship');
  reasons['petition_for_guardianship'] = 'A petition to be appointed as legal guardian of the minor child.';

  docs.push('guardian_declaration');
  reasons['guardian_declaration'] = 'A declaration describing your relationship to the child and the circumstances requiring guardianship.';

  docs.push('notice_to_parents');
  reasons['notice_to_parents'] = 'Courts require notice to be given to the child\'s parents (even if their location is unknown, you must attempt service).';

  if (data.childHasEstate || data.guardianshipType === 'general' || data.guardianshipType === 'estate_only') {
    docs.push('petition_for_guardian_of_estate');
    reasons['petition_for_guardian_of_estate'] = 'Since the child has assets, a separate petition for guardianship of the estate is required.';
  }

  if (data.indigencyRequested) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'A fee waiver request based on financial hardship.';
  }

  return { documents: docs, reasons };
};

// Adoption
HANDLERS['*:adoption'] = function(data) {
  const docs = [];
  const reasons = {};

  docs.push('petition_for_adoption');
  reasons['petition_for_adoption'] = 'The core adoption petition filed with the court.';

  if (data.adoptionType === 'stepparent') {
    docs.push('consent_to_adoption');
    reasons['consent_to_adoption'] = 'The other biological parent\'s written consent to the adoption (or documentation of terminated parental rights).';

    docs.push('stepparent_adoption_declaration');
    reasons['stepparent_adoption_declaration'] = 'A declaration describing your relationship with the child and the circumstances of the adoption.';
  } else if (data.adoptionType === 'adult') {
    docs.push('adult_adoptee_consent');
    reasons['adult_adoptee_consent'] = 'The adult adoptee\'s written consent to the adoption.';
  } else if (data.adoptionType === 'relative') {
    docs.push('consent_to_adoption');
    reasons['consent_to_adoption'] = 'Written consent from the biological parents or documentation of terminated parental rights.';
  }

  if (data.indigencyRequested) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'A fee waiver request based on financial hardship.';
  }

  return { documents: docs, reasons };
};

// Emancipation
HANDLERS['*:emancipation'] = function(data) {
  const docs = [];
  const reasons = {};

  docs.push('petition_for_emancipation');
  reasons['petition_for_emancipation'] = 'A petition to the court requesting legal emancipation from parental control.';

  docs.push('emancipation_declaration');
  reasons['emancipation_declaration'] = 'A sworn declaration demonstrating financial self-sufficiency and the reasons emancipation is in your best interest.';

  docs.push('financial_statement');
  reasons['financial_statement'] = 'A financial statement showing your income and ability to support yourself.';

  return { documents: docs, reasons };
};

// ─── Civil Law Matter Types ───────────────────────────────────────────────────

// Small Claims
HANDLERS['*:small_claims'] = function(data) {
  const docs = [];
  const reasons = {};

  docs.push('small_claims_complaint');
  reasons['small_claims_complaint'] = 'The complaint form to file your small claims case.';

  if (data.demandSent === false) {
    docs.push('demand_letter');
    reasons['demand_letter'] = 'A formal demand letter sent before filing shows the court you tried to resolve this first.';
  }

  if (data.indigencyRequested) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'A fee waiver request for the filing fee (typically $30–100).';
  }

  return { documents: docs, reasons };
};

// Name Change
HANDLERS['*:name_change'] = function(data) {
  const docs = [];
  const reasons = {};

  docs.push('petition_for_name_change');
  reasons['petition_for_name_change'] = 'A petition to the court requesting a legal name change.';

  if (!data.publicationWaiverRequested) {
    docs.push('notice_of_petition_name_change');
    reasons['notice_of_petition_name_change'] = 'Most states require publication of the name change petition in a local newspaper.';
  }

  if (data.isForMinor) {
    docs.push('minor_name_change_declaration');
    reasons['minor_name_change_declaration'] = 'A declaration explaining why the name change is in the minor child\'s best interest.';
  }

  if (data.indigencyRequested) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'A fee waiver request based on financial hardship.';
  }

  return { documents: docs, reasons };
};

// Debt Defense
HANDLERS['*:debt_defense'] = function(data) {
  const docs = [];
  const reasons = {};

  docs.push('answer_to_complaint');
  reasons['answer_to_complaint'] = 'Your formal Answer to the debt collection lawsuit — must be filed before the deadline.';

  if (data.hasCounterclaim) {
    docs.push('counterclaim');
    reasons['counterclaim'] = 'A counterclaim for FDCPA violations or other improper debt collection practices.';
  }

  if (data.statuteExpired) {
    docs.push('motion_to_dismiss');
    reasons['motion_to_dismiss'] = 'A motion to dismiss based on the expired statute of limitations.';
  }

  if (data.indigencyRequested) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'A fee waiver request based on financial hardship.';
  }

  return { documents: docs, reasons };
};

// Landlord-Tenant
HANDLERS['*:landlord_tenant'] = function(data) {
  const docs = [];
  const reasons = {};

  const matterType = data.matterType;

  if (matterType === 'eviction') {
    if (!data.noticeServed) {
      docs.push('notice_to_vacate');
      reasons['notice_to_vacate'] = 'A written notice to vacate is required before filing for eviction in all states.';
    }
    docs.push('eviction_complaint');
    reasons['eviction_complaint'] = 'An unlawful detainer complaint to begin the eviction process.';

  } else if (matterType === 'deposit_dispute') {
    docs.push('small_claims_complaint');
    reasons['small_claims_complaint'] = 'A small claims complaint to recover your wrongfully withheld security deposit.';
    docs.push('demand_letter');
    reasons['demand_letter'] = 'A formal demand letter to the landlord requesting return of the deposit.';

  } else if (matterType === 'habitability') {
    docs.push('habitability_complaint');
    reasons['habitability_complaint'] = 'A complaint documenting the uninhabitable conditions and requesting repairs or rent reduction.';
    docs.push('repair_demand_letter');
    reasons['repair_demand_letter'] = 'A written demand for repairs documenting your notice to the landlord.';

  } else if (matterType === 'wrongful_eviction') {
    docs.push('answer_to_eviction');
    reasons['answer_to_eviction'] = 'Your answer defending against the eviction complaint.';
    docs.push('tenant_declaration');
    reasons['tenant_declaration'] = 'A declaration documenting the facts supporting your defense.';

  } else {
    docs.push('lease_dispute_complaint');
    reasons['lease_dispute_complaint'] = 'A complaint for breach of lease terms.';
  }

  if (data.indigencyRequested) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'A fee waiver request based on financial hardship.';
  }

  return { documents: docs, reasons };
};

// Civil Harassment Restraining Order
HANDLERS['*:civil_harassment'] = function(data) {
  const docs = [];
  const reasons = {};

  if (data.wantsTro) {
    docs.push('request_for_tro');
    reasons['request_for_tro'] = 'An emergency Temporary Restraining Order — typically granted same-day without a hearing.';
  }

  docs.push('petition_for_chro');
  reasons['petition_for_chro'] = 'A Civil Harassment Restraining Order petition for court protection against the harasser.';

  docs.push('chro_declaration');
  reasons['chro_declaration'] = 'A sworn declaration detailing the specific incidents of harassment, stalking, or threats.';

  return { documents: docs, reasons };
};

// General Civil
HANDLERS['*:general_civil'] = function(data) {
  const docs = [];
  const reasons = {};

  docs.push('civil_complaint');
  reasons['civil_complaint'] = 'A civil complaint setting out your legal claims and the damages you are seeking.';

  if (data.demandSent === false) {
    docs.push('demand_letter');
    reasons['demand_letter'] = 'A formal pre-suit demand letter showing the court you tried to resolve this first.';
  }

  if (data.indigencyRequested) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'A fee waiver request based on financial hardship.';
  }

  return { documents: docs, reasons };
};

// Probate
HANDLERS['*:probate'] = function(data) {
  const docs = [];
  const reasons = {};

  const type = data.proceedingType;

  if (type === 'full_probate') {
    docs.push('petition_for_probate');
    reasons['petition_for_probate'] = 'A petition to open probate and be appointed as administrator or executor of the estate.';

    if (data.hadWill) {
      docs.push('petition_to_admit_will');
      reasons['petition_to_admit_will'] = 'A petition to admit the will to probate and have it recognized by the court.';
    }

    docs.push('notice_to_creditors');
    reasons['notice_to_creditors'] = 'Required notice to potential creditors of the estate.';

  } else if (type === 'small_estate_affidavit') {
    docs.push('small_estate_affidavit');
    reasons['small_estate_affidavit'] = 'A Small Estate Affidavit allowing collection of assets without formal probate.';

  } else if (type === 'affidavit_of_heirship') {
    docs.push('affidavit_of_heirship');
    reasons['affidavit_of_heirship'] = 'An Affidavit of Heirship to transfer real property to the legal heirs without probate.';

  } else if (type === 'muniment_of_title') {
    docs.push('application_for_muniment_of_title');
    reasons['application_for_muniment_of_title'] = 'A Texas Muniment of Title application — a simplified process to transfer real estate title when there are no debts.';

  } else if (type === 'summary_admin') {
    docs.push('petition_for_summary_administration');
    reasons['petition_for_summary_administration'] = 'A petition for summary administration when the estate qualifies for expedited processing.';
  }

  if (data.indigencyRequested) {
    docs.push('indigency_affidavit');
    reasons['indigency_affidavit'] = 'A fee waiver request based on financial hardship.';
  }

  return { documents: docs, reasons };
};

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

// ─── General affidavit types — universal ──────────────────────────────────────
// These produce a single affidavit document. The affidavit_type is passed as
// the practiceArea from GeneralAffidavitOrchestrator so keys match typeId.

function selectSingleAffidavit(reason) {
  return function(data) {
    return {
      documents: ['affidavit'],
      reasons: { affidavit: reason }
    };
  };
}

HANDLERS['*:general_affidavit'] = selectSingleAffidavit(
  'A general-purpose sworn affidavit documenting your statement of facts.'
);

HANDLERS['*:affidavit_of_residency'] = selectSingleAffidavit(
  'A sworn affidavit certifying your current place of residence.'
);

HANDLERS['*:affidavit_of_identity'] = selectSingleAffidavit(
  'A sworn affidavit confirming your legal name and identity.'
);

HANDLERS['*:financial_affidavit'] = selectSingleAffidavit(
  'A sworn financial disclosure documenting income, expenses, assets, and liabilities.'
);

HANDLERS['*:affidavit_of_support'] = selectSingleAffidavit(
  'A sworn affidavit vouching for another person\'s housing, finances, or character.'
);

HANDLERS['*:affidavit_of_no_divorce'] = selectSingleAffidavit(
  'A sworn affidavit certifying you have never been divorced and no proceedings are pending.'
);

HANDLERS['*:affidavit_of_lost_document'] = selectSingleAffidavit(
  'A sworn affidavit attesting that an original document has been lost and requesting a replacement.'
);

HANDLERS['*:affidavit_of_no_lien'] = selectSingleAffidavit(
  'A sworn affidavit certifying the property is free and clear of all liens.'
);

HANDLERS['*:affidavit_of_domicile'] = selectSingleAffidavit(
  'A sworn affidavit certifying the deceased person\'s state of legal domicile at time of death.'
);

HANDLERS['*:affidavit_of_survivorship'] = selectSingleAffidavit(
  'A sworn affidavit establishing your right as surviving joint tenant to the property.'
);

// Estate types produce their own named document sets

HANDLERS['*:affidavit_of_heirship'] = function(data) {
  return {
    documents: ['affidavit_of_heirship'],
    reasons: {
      affidavit_of_heirship: 'An Affidavit of Heirship establishing the rightful heirs without formal probate.'
    }
  };
};

HANDLERS['*:small_estate_affidavit'] = function(data) {
  return {
    documents: ['small_estate_affidavit'],
    reasons: {
      small_estate_affidavit: 'A Small Estate Affidavit allowing you to collect the deceased\'s assets without formal probate proceedings.'
    }
  };
};

HANDLERS['*:vehicle_transfer_affidavit'] = function(data) {
  return {
    documents: ['vehicle_transfer_affidavit'],
    reasons: {
      vehicle_transfer_affidavit: 'A Vehicle Transfer Affidavit required by the DMV to transfer the vehicle title.'
    }
  };
};

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
