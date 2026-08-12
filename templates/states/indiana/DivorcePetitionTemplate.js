// templates/states/indiana/DivorcePetitionTemplate.js
// Indiana Petition for Dissolution of Marriage template
// Complies with IC 31-15 (Dissolution of Marriage)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Indiana Petition for Dissolution of Marriage Template
 *
 * Legal References:
 * - IC 31-15 — Dissolution of Marriage
 * - IC 31-15-2-6 — Residency requirement (6 months state, 3 months county)
 * - IC 31-15-2-3 — Grounds for dissolution
 * - IC 31-15-2-10 — 60-day waiting period from filing
 * - IC 31-15-7-5 — Disposition of property (equitable distribution, presumption of equal)
 * - IC 31-15-7-2 — Spousal maintenance
 * - IC 31-17-2 — Custody determination (legal and physical custody)
 * - IC 31-16-6 — Child support orders (guidelines are the Ind. Child Support Rules and Guidelines)
 *
 * Indiana-Specific Notes:
 * - Called "Dissolution of Marriage" — NOT divorce
 * - Primarily no-fault — "irretrievable breakdown" is most common ground
 * - Also has fault grounds: felony conviction, impotence, incurable insanity (2+ years)
 * - 6-month state / 3-month county residency requirement
 * - 60-day waiting period from date of filing
 * - "Legal Custody" and "Physical Custody" (standard terminology)
 * - "Parenting Time" (per Indiana Parenting Time Guidelines)
 * - "Spousal Maintenance" (very limited — not traditional alimony)
 * - Equitable distribution with presumption of equal division
 * - Filed in Circuit Court or Superior Court
 * - Case number label: "CAUSE NO."
 */
class IndianaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'IN';
    this.stateName = 'Indiana';
    this.documentTitle = 'PETITION FOR DISSOLUTION OF MARRIAGE';

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

    // Indiana — 6 months state, 3 months county
    this.residencyRequirements = {
      stateMonths: 6,
      countyMonths: 3,
      description: 'At least one party must have been a resident of Indiana for at least 6 months and a resident of the county of filing for at least 3 months immediately preceding the filing. (IC 31-15-2-6)'
    };

    // Indiana waiting period — 60 days from filing
    this.waitingPeriod = {
      days: 60,
      startsFrom: 'filing_date',
      exceptions: [],
      description: 'The final hearing cannot be held until at least 60 days have elapsed after the filing of the petition. (IC 31-15-2-10)'
    };
  }

  /**
   * Get Indiana case number label — "CAUSE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CAUSE NO.';
  }

  /**
   * Get default court for Indiana county — Circuit Court or Superior Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `${countyName} County Circuit Court, State of Indiana`;
  }

  /**
   * Generate Indiana header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF INDIANA';
  }

  /**
   * Generate Indiana venue — title case per Indiana practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Indiana jurisdiction statement — 6-month state, 3-month county
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been a resident of the State of Indiana for at least six (6) months and a resident of ${divorceData.county || '[COUNTY]'} County for at least three (3) months immediately preceding the filing of this Petition. (IC 31-15-2-6)`;
  }

  /**
   * Get Indiana venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner or Respondent resides in ${divorceData.county || '[COUNTY]'} County, Indiana`;
  }

  /**
   * Generate Indiana grounds section — irretrievable breakdown (primary) plus fault grounds
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'irretrievable_breakdown';

    if (grounds === 'irretrievable_breakdown' || grounds === 'no_fault') {
      items.push({
        number: paragraphNum++,
        content: 'The marriage of the parties is irretrievably broken. (IC 31-15-2-3(1))',
        type: 'grounds'
      });
    } else if (grounds === 'felony_conviction') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has been convicted of a felony subsequent to the marriage. (IC 31-15-2-3(2))',
        type: 'grounds'
      });
    } else if (grounds === 'impotence') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent was impotent at the time of the marriage. (IC 31-15-2-3(3))',
        type: 'grounds'
      });
    } else if (grounds === 'incurable_insanity') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has been incurably insane for a period of at least two (2) years. (IC 31-15-2-3(4))',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The marriage of the parties is irretrievably broken. (IC 31-15-2-3(1))',
        type: 'grounds'
      });
    }

    return {
      title: 'IV. GROUNDS FOR DISSOLUTION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Indiana children section — uses "legal custody" and "physical custody"
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
        content: 'Petitioner requests the Court to determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to IC 31-17-2, and to establish a parenting time schedule in accordance with the Indiana Parenting Time Guidelines.',
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
   * Generate Indiana property section — marital property / equitable distribution with equal presumption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Petitioner requests that the Court divide the marital property and debts in a just and reasonable manner pursuant to IC 31-15-7-5, which presumes an equal division.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Petitioner requests the Court to consider any factors warranting a deviation from equal division, including the contribution of each spouse to the acquisition of property, whether property was acquired before the marriage, the economic circumstances of each spouse, the conduct of the parties, and the earnings or earning ability of each party.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Indiana relief section — uses Indiana-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Petitioner requests that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Enter a Decree of Dissolution of Marriage;',
      'Divide the marital property and debts in a just and reasonable manner pursuant to IC 31-15-7-5;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to IC 31-17-2;');
      reliefItems.push('Establish a parenting time schedule in accordance with the Indiana Parenting Time Guidelines;');
      reliefItems.push('Order child support in accordance with the Indiana Child Support Guidelines, IC 31-16-6;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal maintenance to Petitioner pursuant to IC 31-15-7-2;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
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
   * Get Indiana verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Indiana that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
  }

  /**
   * Perform Indiana-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Indiana dissolution petitions');
    }

    warnings.push('Indiana requires 6 months state residency and 3 months county residency before filing. (IC 31-15-2-6)');
    warnings.push('The final hearing cannot be held until 60 days have elapsed after filing the petition. (IC 31-15-2-10)');
    warnings.push('Indiana presumes an equal division of marital property. (IC 31-15-7-5)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A parenting time schedule must be established per the Indiana Parenting Time Guidelines.');
      warnings.push('Child support must be calculated using the Indiana Child Support Guidelines (IC 31-16-6).');
    }

    return { errors, warnings };
  }
}

module.exports = IndianaDivorcePetitionTemplate;
