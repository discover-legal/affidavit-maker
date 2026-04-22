// templates/states/rhode_island/DivorcePetitionTemplate.js
// Rhode Island Complaint for Divorce template
// Complies with R.I. Gen. Laws §15-5 (Divorce)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Rhode Island Complaint for Divorce Template
 *
 * Legal References:
 * - R.I. Gen. Laws §15-5 — Divorce
 * - R.I. Gen. Laws §15-5-12 — Residency (1 year)
 * - R.I. Gen. Laws §15-5-2 — Fault grounds
 * - R.I. Gen. Laws §15-5-3.1 — No-fault ground (irreconcilable differences)
 * - R.I. Gen. Laws §15-5-16.1 — Equitable distribution of property
 * - R.I. Gen. Laws §15-5-16 — Custody, alimony, child support
 * - R.I. Gen. Laws §8-10-1 — Family Court jurisdiction
 *
 * Rhode Island-Specific Notes:
 * - Called "Complaint for Divorce" (NOT Petition)
 * - Parties: "Plaintiff" and "Defendant"
 * - Both fault and no-fault grounds available
 * - No-fault: "irreconcilable differences"
 * - 1-year residency requirement (RSA §15-5-12)
 * - 3-month (90-day) waiting period between nominal decree and final judgment for irreconcilable differences; 21 days for 3-year separation
 * - "Legal Custody" and "Physical Placement"
 * - "Visitation"
 * - "Alimony"
 * - Equitable distribution of marital property
 * - Filed in Family Court
 * - Case number label: "NO."
 */
class RhodeIslandDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'RI';
    this.stateName = 'Rhode Island';
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

    // Rhode Island — 1 year residency
    this.residencyRequirements = {
      stateMonths: 12,
      countyMonths: null,
      description: 'The filing spouse must have lived in Rhode Island for at least one year before filing for divorce. (R.I. Gen. Laws §15-5-12)'
    };

    // Rhode Island — 3-month waiting period between nominal decree and final judgment
    this.waitingPeriod = {
      days: 90,
      startsFrom: 'nominal_decree',
      exceptions: [
        {
          ground: 'living_separate_3_years',
          days: 21,
          description: 'For divorces on the ground of living separate and apart for 3 years, the waiting period is 21 days'
        }
      ],
      description: 'Rhode Island has a mandatory 3-month (90-day) waiting period between the nominal decree (initial hearing) and entry of the Final Judgment of Divorce for irreconcilable differences cases. For 3-year separation cases, the waiting period is 21 days.'
    };
  }

  /**
   * Get Rhode Island case number label — "NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'NO.';
  }

  /**
   * Get default court for Rhode Island — Family Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    return 'Rhode Island Family Court';
  }

  /**
   * Generate Rhode Island header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF RHODE ISLAND';
  }

  /**
   * Generate Rhode Island venue — title case per RI practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Rhode Island jurisdiction statement — 1-year residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has been a resident of the State of Rhode Island for at least one (1) year immediately preceding the filing of this Complaint. This Court has jurisdiction over this matter pursuant to R.I. Gen. Laws §15-5-12.`;
  }

  /**
   * Get Rhode Island venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Plaintiff or Defendant resides in ${divorceData.county || '[COUNTY]'} County, Rhode Island`;
  }

  /**
   * Generate Rhode Island grounds section — irreconcilable differences (primary) plus fault grounds
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'irreconcilable_differences';

    if (grounds === 'irreconcilable_differences' || grounds === 'no_fault') {
      items.push({
        number: paragraphNum++,
        content: 'Irreconcilable differences have caused the irremediable breakdown of the marriage. (R.I. Gen. Laws §15-5-3.1)',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has committed adultery. (R.I. Gen. Laws §15-5-2(2))',
        type: 'grounds'
      });
    } else if (grounds === 'extreme_cruelty') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been guilty of extreme cruelty. (R.I. Gen. Laws §15-5-2(3))',
        type: 'grounds'
      });
    } else if (grounds === 'willful_desertion') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has willfully deserted the Plaintiff for five years. (R.I. Gen. Laws §15-5-2(4))',
        type: 'grounds'
      });
    } else if (grounds === 'habitual_drunkenness') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been continually drunk. (R.I. Gen. Laws §15-5-2(5))',
        type: 'grounds'
      });
    } else if (grounds === 'living_separate') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have lived separate and apart without cohabitation for at least three years. (R.I. Gen. Laws §15-5-2(9))',
        type: 'grounds'
      });
    } else if (grounds === 'gross_misbehavior') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has engaged in gross misbehavior and wickedness repugnant to and in violation of the marriage covenant. (R.I. Gen. Laws §15-5-2(10))',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'Irreconcilable differences have caused the irremediable breakdown of the marriage. (R.I. Gen. Laws §15-5-3.1)',
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
   * Generate Rhode Island children section — uses "legal custody" and "physical placement"
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
        content: 'The following children were born of or adopted during this marriage:',
        type: 'children_info'
      });

      if (divorceData.children && divorceData.children.length > 0) {
        divorceData.children.forEach((child, index) => {
          const childInfo = typeof child === 'string'
            ? child
            : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate) || '[BIRTH DATE]'}`;
          items.push({
            number: paragraphNum++,
            content: `Child ${index + 1}: ${childInfo}`,
            type: 'child_detail'
          });
        });
      }

      items.push({
        number: paragraphNum++,
        content: 'Plaintiff requests the Court to determine legal custody and physical placement of the minor child(ren) in the best interests of the child(ren) pursuant to R.I. Gen. Laws §15-5-16, and to establish a visitation schedule for the non-custodial parent.',
        type: 'children_info'
      });
    }

    return {
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Rhode Island property section — equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Plaintiff requests that the Court divide the marital property and debts equitably pursuant to R.I. Gen. Laws §15-5-16.1.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests the Court to consider all relevant factors including the length of the marriage, the conduct of the parties during the marriage, the contribution of each party to the acquisition, preservation, or appreciation of property, and the needs of the custodial parent.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Rhode Island relief section — uses RI-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff requests that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Enter a Final Judgment of Divorce;',
      'Divide the marital property and debts equitably pursuant to R.I. Gen. Laws §15-5-16.1;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine legal custody and physical placement of the minor child(ren) in the best interests of the child(ren) pursuant to R.I. Gen. Laws §15-5-16;');
      reliefItems.push('Establish a visitation schedule for the non-custodial parent;');
      reliefItems.push('Order child support in accordance with the Rhode Island Family Court Child Support Guidelines;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff pursuant to R.I. Gen. Laws §15-5-16;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Plaintiff's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other and further relief as the Court deems just and proper.');

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
   * Get Rhode Island verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Rhode Island that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform Rhode Island-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Rhode Island divorce complaints');
    }

    warnings.push('Rhode Island requires 1 year of residency before filing. (R.I. Gen. Laws §15-5-12)');
    warnings.push('Rhode Island uses "Complaint for Divorce" with "Plaintiff" and "Defendant" terminology.');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('Child support must be calculated using the Rhode Island Family Court Child Support Guidelines.');
    }

    return { errors, warnings };
  }
}

module.exports = RhodeIslandDivorcePetitionTemplate;
