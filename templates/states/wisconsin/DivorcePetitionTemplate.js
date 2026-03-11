// templates/states/wisconsin/DivorcePetitionTemplate.js
// Wisconsin Petition for Divorce template
// Complies with Wis. Stat. Chapter 767 (Actions Affecting the Family)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Wisconsin Petition for Divorce Template
 *
 * Legal References:
 * - Wis. Stat. Chapter 767 — Actions Affecting the Family
 * - Wis. Stat. §767.301 — Residency requirement (6 months state, 30 days county)
 * - Wis. Stat. §767.315 — Grounds for divorce (irretrievable breakdown — no-fault only)
 * - Wis. Stat. §767.335 — 120-day waiting period from service or joint filing
 * - Wis. Stat. §767.61 — Property division (community property, presumption of equal division)
 * - Wis. Stat. §767.56 — Maintenance
 * - Wis. Stat. §767.41 — Legal custody and physical placement
 * - Wis. Stat. §767.511 — Child support (percentage of income)
 *
 * Wisconsin-Specific Notes:
 * - Called "Divorce" — NOT dissolution of marriage
 * - Pure no-fault state — "irretrievable breakdown" is the ONLY ground
 * - 6-month state / 30-day county residency requirement
 * - 120-day waiting period from service of petition (or joint filing)
 * - "Legal Custody" and "Physical Placement" (NOT "physical custody")
 * - "Periods of Physical Placement" (NOT parenting time or visitation)
 * - "Maintenance" (NOT alimony or spousal support)
 * - Community property state — presumption of equal (50/50) division
 * - Filed in Circuit Court
 * - Case number label: "CASE NO."
 */
class WisconsinDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'WI';
    this.stateName = 'Wisconsin';
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

    // Wisconsin — 6 months state, 30 days county
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 30,
      description: 'At least one party must have been a resident of Wisconsin for at least 6 months and a resident of the county of filing for at least 30 days immediately preceding the filing. (Wis. Stat. §767.301)'
    };

    // Wisconsin waiting period — 120 days from service or joint filing
    this.waitingPeriod = {
      days: 120,
      startsFrom: 'service_or_joint_filing',
      exceptions: [],
      description: 'No final hearing may be held until at least 120 days after service of the summons and petition on the respondent, or after the filing of a joint petition. (Wis. Stat. §767.335)'
    };
  }

  /**
   * Get Wisconsin case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Wisconsin county — Circuit Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `${countyName} County Circuit Court, State of Wisconsin`;
  }

  /**
   * Generate Wisconsin header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF WISCONSIN';
  }

  /**
   * Generate Wisconsin venue — title case per Wisconsin practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Wisconsin jurisdiction statement — 6-month state, 30-day county
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been a resident of the State of Wisconsin for at least six (6) months and a resident of ${divorceData.county || '[COUNTY]'} County for at least thirty (30) days immediately preceding the filing of this Petition. (Wis. Stat. §767.301)`;
  }

  /**
   * Get Wisconsin venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner or Respondent resides in ${divorceData.county || '[COUNTY]'} County, Wisconsin`;
  }

  /**
   * Generate Wisconsin grounds section — irretrievable breakdown only (pure no-fault)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    // Wisconsin is a pure no-fault state — irretrievable breakdown is the only ground
    items.push({
      number: paragraphNum++,
      content: 'The marriage of the parties is irretrievably broken. (Wis. Stat. §767.315)',
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DIVORCE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Wisconsin children section — uses "legal custody" and "physical placement"
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
        content: 'Petitioner requests the Court to determine legal custody and establish a physical placement schedule for the minor child(ren) in the best interests of the child(ren) pursuant to Wis. Stat. §767.41.',
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
   * Generate Wisconsin property section — community property / equal division
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Wisconsin is a community property state with a presumption of equal division. Petitioner requests that the Court divide the marital property and debts equally pursuant to Wis. Stat. §767.61.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Petitioner requests the Court to consider all relevant factors in dividing the property, including the length of the marriage, the property brought to the marriage by each party, the contribution of each party, the age and health of the parties, the earning capacity of each party, and any other factors the Court deems relevant, should deviation from equal division be warranted.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Wisconsin relief section — uses Wisconsin-specific terminology
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
      'Enter a Judgment of Divorce;',
      'Divide the marital property equally pursuant to Wis. Stat. §767.61;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award legal custody and establish a physical placement schedule for the minor child(ren) pursuant to Wis. Stat. §767.41;');
      reliefItems.push('Order child support per the Wisconsin Child Support Guidelines (Wis. Stat. §767.511);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award maintenance to Petitioner pursuant to Wis. Stat. §767.56;');
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
   * Get Wisconsin verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Wisconsin that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
  }

  /**
   * Perform Wisconsin-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Wisconsin divorce petitions');
    }

    warnings.push('Wisconsin requires 6 months state residency and 30 days county residency before filing. (Wis. Stat. §767.301)');
    warnings.push('No final hearing may be held until 120 days after service of the summons and petition, or after the filing of a joint petition. (Wis. Stat. §767.335)');
    warnings.push('Wisconsin presumes an equal (50/50) division of marital property. (Wis. Stat. §767.61)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A proposed parenting plan establishing legal custody and physical placement must be filed per Wis. Stat. §767.41.');
      warnings.push('Child support must be calculated using the Wisconsin percentage of income standard (Wis. Stat. §767.511).');
    }

    return { errors, warnings };
  }
}

module.exports = WisconsinDivorcePetitionTemplate;
