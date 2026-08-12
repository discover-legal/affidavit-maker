// templates/states/iowa/DivorcePetitionTemplate.js
// Iowa Petition for Dissolution of Marriage template
// Complies with Iowa Code Chapter 598 (Dissolution of Marriage)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Iowa Petition for Dissolution of Marriage Template
 *
 * Legal References:
 * - Iowa Code §598 — Dissolution of Marriage and Domestic Relations
 * - Iowa Code §598.6 — Residency requirement (1 year)
 * - Iowa Code §598.17 — Grounds — irretrievable breakdown (no-fault only)
 * - Iowa Code §598.19 — 90-day waiting period from service
 * - Iowa Code §598.21 — Property division — equitable distribution of ALL property
 * - Iowa Code §598.21A — Spousal support (traditional, rehabilitative, reimbursement)
 * - Iowa Code §598.41 — Custody — joint legal custody, physical care, visitation
 * - Iowa Code §598.21B — Iowa Child Support Guidelines (income shares)
 *
 * Iowa-Specific Notes:
 * - Called "Dissolution of Marriage" — NOT divorce
 * - No-fault only — irretrievable breakdown is the sole ground
 * - 1-year state residency (unless defendant is IA resident)
 * - 90-day waiting period from service date (not filing)
 * - Iowa uses "Physical Care" not "Physical Custody"
 * - "Visitation" terminology
 * - "Spousal Support" — 3 types: traditional, rehabilitative, reimbursement
 * - ALL property subject to division including pre-marital
 * - Filed in District Court
 * - Case number label: "CASE NO."
 * - Parties: "Petitioner" and "Respondent"
 */
class IowaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'IA';
    this.stateName = 'Iowa';
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

    // Iowa — 1 year state residency
    this.residencyRequirements = {
      stateMonths: 12,
      countyMonths: 0,
      description: 'At least one party must have been a resident of Iowa for at least one (1) year prior to filing, unless the defendant is a resident of Iowa. (Iowa Code §598.6)'
    };

    // Iowa waiting period — 90 days from service
    this.waitingPeriod = {
      days: 90,
      startsFrom: 'service_date',
      exceptions: [],
      description: 'No decree shall be entered until ninety (90) days after the date the petition is served on the respondent. (Iowa Code §598.19)'
    };
  }

  /**
   * Get Iowa case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Iowa county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Iowa District Court for ${countyName} County`;
  }

  /**
   * Generate Iowa header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF IOWA';
  }

  /**
   * Generate Iowa venue — title case per Iowa practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Iowa jurisdiction statement — 1-year state residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been a resident of the State of Iowa for at least one (1) year immediately preceding the filing of this Petition. (Iowa Code §598.6)`;
  }

  /**
   * Get Iowa venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner or Respondent resides in ${divorceData.county || '[COUNTY]'} County, Iowa`;
  }

  /**
   * Generate Iowa grounds section — irretrievable breakdown only (no-fault)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    items.push({
      number: paragraphNum++,
      content: 'There has been a breakdown of the marriage relationship to the extent that the legitimate objects of matrimony have been destroyed and there remains no reasonable likelihood that the marriage can be preserved. (Iowa Code §598.17)',
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DISSOLUTION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Iowa children section — uses "joint legal custody" and "physical care"
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
        content: 'Petitioner requests the Court to determine joint legal custody and physical care of the minor child(ren) in the best interests of the child(ren) pursuant to Iowa Code §598.41, and to establish a visitation schedule.',
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
   * Generate Iowa property section — equitable distribution of ALL property
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated property and debts during the marriage. Petitioner requests that the Court equitably divide all property of both parties pursuant to Iowa Code §598.21. Iowa law provides that all property of both spouses, including property acquired before the marriage, is subject to division.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Petitioner requests the Court to consider the length of the marriage, property brought into the marriage by each party, the contribution of each party to the marriage, the age and physical and emotional health of the parties, the earning capacity of each party, and any other factors the Court deems relevant.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Iowa relief section — uses Iowa-specific terminology
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
      'Equitably divide the property and debts of the parties pursuant to Iowa Code §598.21;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine joint legal custody and physical care of the minor child(ren) in the best interests of the child(ren) pursuant to Iowa Code §598.41;');
      reliefItems.push('Establish a visitation schedule;');
      reliefItems.push('Order child support in accordance with the Iowa Child Support Guidelines, Iowa Code §598.21B;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal support to Petitioner pursuant to Iowa Code §598.21A;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other and further relief as the Court deems just and equitable.');

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
   * Get Iowa verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Iowa that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
  }

  /**
   * Perform Iowa-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Iowa dissolution petitions');
    }

    warnings.push('Iowa requires 1 year of state residency before filing (unless the defendant is an Iowa resident). (Iowa Code §598.6)');
    warnings.push('No decree shall be entered until 90 days after the date the petition is served on the respondent. (Iowa Code §598.19)');
    warnings.push('Iowa law subjects ALL property of both spouses to equitable division, including pre-marital property. (Iowa Code §598.21)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A custody and visitation arrangement must be established per Iowa Code §598.41.');
      warnings.push('Child support must be calculated using the Iowa Child Support Guidelines (Iowa Code §598.21B).');
    }

    return { errors, warnings };
  }
}

module.exports = IowaDivorcePetitionTemplate;
