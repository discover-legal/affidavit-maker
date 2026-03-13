// templates/states/kansas/DivorcePetitionTemplate.js
// Kansas Petition for Divorce template
// Complies with K.S.A. Chapter 23 (Divorce and Maintenance)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Kansas Petition for Divorce Template
 *
 * Legal References:
 * - K.S.A. §23-2701 — Grounds for divorce (incompatibility, failure of marital duty)
 * - K.S.A. §23-2703 — Residency requirement (60 days)
 * - K.S.A. §23-2708 — 60-day waiting period from filing
 * - K.S.A. §23-2802 — Property division (equitable distribution, all property)
 * - K.S.A. §23-2902 — Maintenance
 * - K.S.A. §23-3222 — Custody (legal custody, residency, parenting time)
 * - K.S.A. §23-3001 et seq. — Kansas Child Support Guidelines (income shares)
 *
 * Kansas-Specific Notes:
 * - No-fault only — incompatibility or failure to perform marital duty
 * - 60-day state residency requirement
 * - 60-day waiting period from filing date
 * - Kansas uses "Legal Custody" and "Residency" (not "physical custody")
 * - "Parenting Time" (not visitation)
 * - "Maintenance" (not alimony or spousal support)
 * - ALL property of either spouse subject to division
 * - Filed in District Court, Division of Domestic Relations
 * - Case number label: "CASE NO."
 * - Parties: "Petitioner" and "Respondent"
 */
class KansasDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'KS';
    this.stateName = 'Kansas';
    this.documentTitle = 'PETITION FOR DIVORCE';

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

    // Kansas — 60 days state residency
    this.residencyRequirements = {
      stateMonths: 2,
      countyMonths: 0,
      description: 'At least one party must have been a bona fide resident of Kansas for at least sixty (60) days immediately preceding the filing of the petition. (K.S.A. §23-2703)'
    };

    // Kansas waiting period — 60 days from filing
    this.waitingPeriod = {
      days: 60,
      startsFrom: 'filing_date',
      exceptions: [],
      description: 'No decree of divorce shall be entered until at least sixty (60) days after the date the petition is filed. (K.S.A. §23-2708)'
    };
  }

  /**
   * Get Kansas case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Kansas county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court of ${countyName} County, Kansas, Division of Domestic Relations`;
  }

  /**
   * Generate Kansas header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF KANSAS';
  }

  /**
   * Generate Kansas venue — title case per Kansas practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Kansas jurisdiction statement — 60-day state residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been a bona fide resident of the State of Kansas for at least sixty (60) days immediately preceding the filing of this Petition. (K.S.A. §23-2703)`;
  }

  /**
   * Get Kansas venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner or Respondent resides in ${divorceData.county || '[COUNTY]'} County, Kansas`;
  }

  /**
   * Generate Kansas grounds section — incompatibility or failure of marital duty (no-fault)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'incompatibility';

    if (grounds === 'incompatibility' || grounds === 'no_fault') {
      items.push({
        number: paragraphNum++,
        content: 'The parties are incompatible. (K.S.A. §23-2701(a))',
        type: 'grounds'
      });
    } else if (grounds === 'failure_of_marital_duty') {
      items.push({
        number: paragraphNum++,
        content: 'A party has failed to perform a marital duty or obligation. (K.S.A. §23-2701(b))',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The parties are incompatible. (K.S.A. §23-2701(a))',
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
   * Generate Kansas children section — uses "legal custody" and "residency"
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
        content: 'Petitioner requests the Court to determine legal custody and residency of the minor child(ren) in the best interests of the child(ren) pursuant to K.S.A. §23-3222, and to establish a parenting time schedule.',
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
   * Generate Kansas property section — equitable distribution of ALL property
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated property and debts during the marriage. Petitioner requests that the Court divide all property owned by either party in a just and reasonable manner pursuant to K.S.A. §23-2802.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Petitioner requests the Court to consider the age of the parties, the duration of the marriage, the property owned by the parties, their present and future earning capacities, the time and manner of acquisition of property, family ties and obligations, any allowance of maintenance, dissipation of assets, and the tax consequences of the property division.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Kansas relief section — uses Kansas-specific terminology
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
      'Enter a Decree of Divorce;',
      'Divide all property of the parties in a just and reasonable manner pursuant to K.S.A. §23-2802;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine legal custody and residency of the minor child(ren) in the best interests of the child(ren) pursuant to K.S.A. §23-3222;');
      reliefItems.push('Establish a parenting time schedule;');
      reliefItems.push('Order child support in accordance with the Kansas Child Support Guidelines, K.S.A. §23-3001 et seq.;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award maintenance to Petitioner pursuant to K.S.A. §23-2902;');
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
   * Get Kansas verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Kansas that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
  }

  /**
   * Perform Kansas-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Kansas divorce petitions');
    }

    warnings.push('Kansas requires 60 days of state residency before filing. (K.S.A. §23-2703)');
    warnings.push('No decree shall be entered until 60 days after the petition is filed. (K.S.A. §23-2708)');
    warnings.push('Kansas law subjects ALL property of either party to equitable division. (K.S.A. §23-2802)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A parenting plan must be filed per K.S.A. §23-3222.');
      warnings.push('Child support must be calculated using the Kansas Child Support Guidelines (K.S.A. §23-3001 et seq.).');
    }

    return { errors, warnings };
  }
}

module.exports = KansasDivorcePetitionTemplate;
