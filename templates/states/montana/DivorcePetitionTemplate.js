// templates/states/montana/DivorcePetitionTemplate.js
// Montana Petition for Dissolution of Marriage template
// Complies with MCA Title 40 (Family Law)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Montana Petition for Dissolution of Marriage Template
 *
 * Legal References:
 * - MCA §40-4-104 — Dissolution of marriage (residency, grounds)
 * - MCA §40-4-107 — 20-day waiting period from service or response
 * - MCA §40-4-202 — Property disposition (equitable distribution)
 * - MCA §40-4-203 — Maintenance (spousal support)
 * - MCA §40-4-212 — Parenting plan required
 * - MCA §40-4-234 — Parenting plan criteria and best interest
 * - MCA §40-5-209 — Montana Child Support Guidelines
 *
 * Montana-Specific Notes:
 * - Called "Dissolution of Marriage" (NOT divorce)
 * - Purely no-fault — "irretrievable breakdown" or 180-day separation
 * - 90-day residency requirement (MCA §40-4-104)
 * - 20-day waiting period from service or response (MCA §40-4-107)
 * - Montana eliminated "custody" and "visitation" in 2005 — uses "parenting" exclusively
 * - "Parenting Plan" required in all cases with minor children (MCA §40-4-212)
 * - "Parenting Time" (not visitation)
 * - "Maintenance" (not alimony) — MCA §40-4-203
 * - Equitable distribution
 * - Filed in District Court
 * - Case number label: "CAUSE NO."
 * - Parties: "Petitioner" and "Respondent"
 */
class MontanaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'MT';
    this.stateName = 'Montana';
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

    // Montana — 90 days residency
    this.residencyRequirements = {
      stateMonths: 3,
      countyMonths: null,
      description: 'At least one party must have been domiciled in Montana for 90 days preceding the filing of the petition. (MCA §40-4-104)'
    };

    // Montana — 20-day waiting period from service or response
    this.waitingPeriod = {
      days: 20,
      startsFrom: 'service_or_response',
      exceptions: [],
      description: 'No decree may be entered until at least 20 days after the respondent is served or files a response. (MCA §40-4-107)'
    };
  }

  /**
   * Get Montana case number label — "CAUSE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CAUSE NO.';
  }

  /**
   * Get default court for Montana county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Montana ${countyName} County District Court`;
  }

  /**
   * Generate Montana header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MONTANA';
  }

  /**
   * Generate Montana venue — title case per Montana practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Montana jurisdiction statement — 90-day residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been domiciled in the State of Montana for at least ninety (90) days preceding the filing of this Petition. This Court has jurisdiction over this matter pursuant to MCA §40-4-104.`;
  }

  /**
   * Get Montana venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner or Respondent resides in ${divorceData.county || '[COUNTY]'} County, Montana`;
  }

  /**
   * Generate Montana grounds section — no-fault only (irretrievable breakdown or 180-day separation)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'irretrievable_breakdown';

    if (grounds === 'separation_180_days') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have been living separate and apart for more than one hundred eighty (180) consecutive days. (MCA §40-4-104)',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The marriage is irretrievably broken. (MCA §40-4-104)',
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
   * Generate Montana children section — uses "parenting" exclusively (no "custody" or "visitation")
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
        content: 'Petitioner requests the Court to adopt a parenting plan in the best interests of the child(ren) pursuant to MCA §40-4-212 and §40-4-234, establishing the allocation of parenting time and decision-making authority.',
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
   * Generate Montana property section — equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated property and debts during the marriage. Petitioner requests that the Court divide the property and debts of the parties in a just and equitable manner pursuant to MCA §40-4-202.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Petitioner requests the Court to consider all relevant factors including the duration of the marriage, the age, health, station, occupation, amount and sources of income, vocational skills, employability, estate, liabilities, and needs of each of the parties.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Montana relief section — uses Montana-specific terminology
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
      'Divide the property and debts of the parties in a just and equitable manner pursuant to MCA §40-4-202;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Adopt a parenting plan in the best interests of the child(ren) pursuant to MCA §40-4-212 and §40-4-234;');
      reliefItems.push('Order child support in accordance with the Montana Child Support Guidelines, MCA §40-5-209;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award maintenance to Petitioner pursuant to MCA §40-4-203;');
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
   * Get Montana verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Montana that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
  }

  /**
   * Perform Montana-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Montana dissolution petitions');
    }

    warnings.push('Montana requires 90 days of domicile before filing. (MCA §40-4-104)');
    warnings.push('A decree cannot be entered until 20 days after service or filing of response. (MCA §40-4-107)');
    warnings.push('Montana is a purely no-fault state — only irretrievable breakdown or 180-day separation.');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A parenting plan is REQUIRED in all cases with minor children. (MCA §40-4-212)');
      warnings.push('Montana uses "parenting" terminology exclusively — not "custody" or "visitation".');
      warnings.push('Child support must be calculated using the Montana Child Support Guidelines (MCA §40-5-209).');
    }

    return { errors, warnings };
  }
}

module.exports = MontanaDivorcePetitionTemplate;
