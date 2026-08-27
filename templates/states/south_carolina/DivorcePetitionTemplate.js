// templates/states/south_carolina/DivorcePetitionTemplate.js
// South Carolina Complaint for Divorce template
// Complies with S.C. Code §20-3 (Divorce)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * South Carolina Complaint for Divorce Template
 *
 * Legal References:
 * - S.C. Code §20-3 — Divorce
 * - S.C. Code §20-3-30 — Residency (3 months if both resident; 1 year if defendant non-resident)
 * - S.C. Code §20-3-10 — Grounds for divorce (5 grounds)
 * - S.C. Code §20-3-80 — Waiting period (90 days fault-based; 1-year separation no-fault)
 * - S.C. Code §20-3-620 — Equitable apportionment of marital property
 * - S.C. Code §20-3-130 — Alimony (periodic, lump-sum, rehabilitative, reimbursement)
 * - S.C. Code §63-15-230 — Child custody (best interest of the child)
 * - S.C. Code §63-17-470 — South Carolina Child Support Guidelines (income shares)
 *
 * South Carolina-Specific Notes:
 * - Called "Complaint for Divorce" — NOT "Petition"
 * - Parties are "Plaintiff" and "Defendant" — NOT Petitioner/Respondent
 * - 5 grounds: adultery, desertion (1 yr), physical cruelty, habitual drunkenness, 1-yr separation
 * - No-fault requires 1 year continuous separation before filing
 * - Fault-based: no waiting to file, but 90 days from filing before decree can be entered
 * - Residency: 3 months if both in SC; 1 year if defendant non-resident
 * - "Custody" and "Visitation" (traditional terminology)
 * - "Alimony" — 4 types available
 * - Equitable distribution (not community property; fair but not necessarily equal)
 * - Filed in Family Court
 * - Case number label: "CIVIL ACTION NO."
 */
class SouthCarolinaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'SC';
    this.stateName = 'South Carolina';
    this.documentTitle = 'COMPLAINT FOR DIVORCE';

    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate',
      'groundsForDivorce'
    ];

    // South Carolina — 3 months if both resident, 1 year if defendant non-resident
    this.residencyRequirements = {
      bothResidentMonths: 3,
      oneNonResidentMonths: 12,
      description: 'If both parties are residents of South Carolina, the Plaintiff must have resided in the state for at least three (3) months before filing. If the Defendant is a non-resident, the Plaintiff must have resided in the state for at least one (1) year before filing. (S.C. Code §20-3-30)'
    };

    // South Carolina waiting period
    this.waitingPeriod = {
      noFault: {
        separationYears: 1,
        description: 'For a no-fault divorce, the parties must have lived separate and apart without cohabitation for at least one (1) year before filing.'
      },
      faultBased: {
        daysAfterFiling: 90,
        description: 'For fault-based grounds, there is no waiting period to file, but the court cannot enter a final decree until at least 90 days after filing and service. (S.C. Code §20-3-80)'
      }
    };
  }

  /**
   * Get South Carolina case number label — "CIVIL ACTION NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CIVIL ACTION NO.';
  }

  /**
   * Get default court for South Carolina county — Family Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Family Court, ${countyName} County, State of South Carolina`;
  }

  /**
   * Generate South Carolina header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF SOUTH CAROLINA';
  }

  /**
   * Generate South Carolina venue — uppercase per South Carolina practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `COUNTY OF ${countyName.toUpperCase()}`;
  }

  /**
   * Get South Carolina jurisdiction statement — complex residency rules
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const county = divorceData.county || '[COUNTY]';
    const isRespondentNonResident = divorceData.respondentNonResident || false;

    if (isRespondentNonResident) {
      return `Plaintiff has been a resident of the State of South Carolina for at least one (1) year immediately preceding the filing of this Complaint. Defendant is a non-resident of the State of South Carolina. This Court has jurisdiction over the parties and the subject matter of this action. (S.C. Code §20-3-30)`;
    }

    return `Plaintiff has been a resident of the State of South Carolina for at least three (3) months immediately preceding the filing of this Complaint. Both parties are residents of South Carolina. Venue is proper in ${county} County. This Court has jurisdiction over the parties and the subject matter of this action. (S.C. Code §20-3-30)`;
  }

  /**
   * Get South Carolina venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Plaintiff or Defendant resides in ${divorceData.county || '[COUNTY]'} County, South Carolina`;
  }

  /**
   * Generate South Carolina grounds section — 4 fault grounds + 1 no-fault
   * Note: SC uses "Plaintiff" and "Defendant" — not "Petitioner" and "Respondent"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'one_year_separation';

    if (grounds === 'one_year_separation' || grounds === 'no_fault') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have lived separate and apart without cohabitation for a period of at least one (1) year continuously. Plaintiff is entitled to a divorce on the ground of one year continuous separation. (S.C. Code §20-3-10(5))',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has committed adultery. Plaintiff is entitled to a divorce on the ground of adultery. (S.C. Code §20-3-10(1))',
        type: 'grounds'
      });
    } else if (grounds === 'desertion') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has deserted the Plaintiff for a period of one (1) year. Plaintiff is entitled to a divorce on the ground of desertion. (S.C. Code §20-3-10(2))',
        type: 'grounds'
      });
    } else if (grounds === 'physical_cruelty') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has engaged in physical cruelty toward the Plaintiff. Plaintiff is entitled to a divorce on the ground of physical cruelty. (S.C. Code §20-3-10(3))',
        type: 'grounds'
      });
    } else if (grounds === 'habitual_drunkenness') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant is habitually intoxicated by alcohol or habitually uses narcotics, and such habit has been in existence for a duration that precludes reasonable hope of reformation. Plaintiff is entitled to a divorce on the ground of habitual drunkenness or narcotics use. (S.C. Code §20-3-10(4))',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The parties have lived separate and apart without cohabitation for a period of at least one (1) year continuously. Plaintiff is entitled to a divorce on the ground of one year continuous separation. (S.C. Code §20-3-10(5))',
        type: 'grounds'
      });
    }

    return {
      title: 'IV. GROUNDS FOR DIVORCE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate South Carolina children section — uses "custody" and "visitation"
   * Note: SC uses "Plaintiff" and "Defendant"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no children born of or adopted during this marriage, and none are expected.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following minor child(ren) were born of or adopted during this marriage:',
        type: 'children_info'
      });

      if (divorceData.children && divorceData.children.length > 0) {
        divorceData.children.forEach((child, index) => {
          const childInfo = typeof child === 'string'
            ? child
            : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '[BIRTH DATE]'}`;
          items.push({
            number: paragraphNum++,
            content: `Child ${index + 1}: ${childInfo}`,
            type: 'child_detail'
          });
        });
      }

      items.push({
        number: paragraphNum++,
        content: 'Plaintiff requests the Court to determine custody and visitation of the minor child(ren) in the best interests of the child(ren) pursuant to S.C. Code §63-15-230 et seq.',
        type: 'children_info'
      });
    }

    // Agreed child arrangements (custody enum, primary residence, agreed
    // support) — pleaded via the base hooks, never silently dropped.
    paragraphNum = this.appendAgreedChildArrangementPleadings(items, paragraphNum, divorceData);

    return {
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate South Carolina property section — equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    // An agreed division (or an explicit no-property case) pleads the
    // parties' actual agreement via the base hooks instead of the
    // generic boilerplate.
    if (divorceData.hasProperty === false || this.hasAgreedPropertyDivision(divorceData)) {
      return super.generatePropertySection(divorceData);
    }

    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Plaintiff requests that the Court equitably apportion the marital property and debts pursuant to S.C. Code §20-3-620.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests the Court to consider all relevant factors in making an equitable apportionment, including the duration of the marriage, the contributions of each party to the acquisition of marital property (including contributions as a homemaker), the value of the marital property, the income and earning capacity of each party, the current and reasonably anticipated expenses and needs of each party, and the marital misconduct or fault of either party.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate South Carolina relief section — uses SC-specific terminology
   * Note: SC uses "Plaintiff" and "Defendant"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff respectfully requests that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Grant Plaintiff a divorce from Defendant;',
      'Equitably divide and apportion the marital property and debts of the parties pursuant to S.C. Code §20-3-620;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award custody of the minor child(ren) to the appropriate party and establish a visitation schedule in the best interests of the child(ren) pursuant to S.C. Code §63-15-230;');
      reliefItems.push('Order child support in accordance with the South Carolina Child Support Guidelines, S.C. Code §63-17-470;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff as the Court deems just and proper pursuant to S.C. Code §20-3-130;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Plaintiff's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other and further relief as the Court deems just and proper.');

    // Agreed corollary relief (agreed support amount, spousal-support

    // waiver, property agreement) — spliced before the final general prayer.

    this.appendAgreedReliefItems(reliefItems, divorceData);


    reliefItems.forEach((relief, index) => {
      const letter = String.fromCharCode(97 + index);
      items.push({
        number: null,
        content: relief,
        type: 'relief_item',
        style: 'letter',
        letter
      });
    });

    return {
      title: 'VII. RELIEF REQUESTED',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get South Carolina verification text
   * Note: SC uses "Plaintiff" terminology
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of South Carolina that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform South Carolina-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for South Carolina divorce complaints');
    }

    const grounds = divorceData.groundsForDivorce || 'one_year_separation';
    if (grounds === 'one_year_separation' || grounds === 'no_fault') {
      warnings.push('No-fault divorce in South Carolina requires that the parties have lived separate and apart without cohabitation for at least one (1) year before filing. (S.C. Code §20-3-10(5))');
    } else {
      warnings.push('For fault-based divorce, the court cannot enter a final decree until at least 90 days after filing and service. (S.C. Code §20-3-80)');
    }

    const isRespondentNonResident = divorceData.respondentNonResident || false;
    if (isRespondentNonResident) {
      warnings.push('Because the Defendant is a non-resident, the Plaintiff must have resided in South Carolina for at least one (1) year before filing. (S.C. Code §20-3-30)');
    } else {
      warnings.push('Both parties are South Carolina residents: the Plaintiff must have resided in the state for at least three (3) months before filing. (S.C. Code §20-3-30)');
    }

    warnings.push('South Carolina follows equitable distribution of marital property. (S.C. Code §20-3-620)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('Custody and visitation must be determined in the best interests of the child(ren). (S.C. Code §63-15-230)');
      warnings.push('Child support must be calculated using the South Carolina Child Support Guidelines (S.C. Code §63-17-470).');
    }

    return { errors, warnings };
  }
}

module.exports = SouthCarolinaDivorcePetitionTemplate;
