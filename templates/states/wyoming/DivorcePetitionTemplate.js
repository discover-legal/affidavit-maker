// templates/states/wyoming/DivorcePetitionTemplate.js
// Wyoming Complaint for Divorce template
// Complies with Wyo. Stat. § 20-2-101 et seq.

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Wyoming Complaint for Divorce Template
 *
 * Legal References:
 * - Wyo. Stat. § 20-2-104 — Grounds for divorce (no-fault: irreconcilable differences)
 * - Wyo. Stat. § 20-2-107 — Residency requirement (60 days)
 * - Wyo. Stat. § 20-2-108 — 20-day waiting period from filing
 * - Wyo. Stat. § 20-2-114 — Property disposition (equitable distribution) and alimony
 * - Wyo. Stat. § 20-2-201 — Custody (joint or sole; best interests of the child)
 * - Wyo. Stat. § 20-2-202 — Visitation
 * - Wyo. Stat. § 20-2-304 — Child support guidelines (income shares model)
 * - Wyo. Stat. § 5-2-118 — District Court jurisdiction
 *
 * Wyoming-Specific Notes:
 * - Called "Complaint for Divorce" and "Decree of Divorce"
 * - No-fault only — irreconcilable differences
 * - 60-day residency requirement
 * - 20-day waiting period from filing before decree can be entered
 * - Standard terminology: "Custody" / "Visitation" / "Alimony"
 * - Equitable distribution (NOT community property)
 * - Filed in District Court
 */
class WyomingDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'WY';
    this.stateName = 'Wyoming';
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

    // Wyoming — 60-day residency (approximately 2 months), no county requirement
    this.residencyRequirements = {
      stateMonths: 2,
      countyDays: 0,
      description: 'The Plaintiff must have been a resident of the State of Wyoming for at least sixty (60) days immediately preceding the filing of this Complaint. (Wyo. Stat. § 20-2-107)'
    };

    // Wyoming waiting period — 20 days from filing
    this.waitingPeriod = {
      days: 20,
      startsFrom: 'filing_date',
      exceptions: [],
      description: 'A Decree of Divorce cannot be entered until at least 20 days have elapsed after the filing of the Complaint for Divorce. (Wyo. Stat. § 20-2-108)'
    };
  }

  /**
   * Get Wyoming case number label — "CIVIL NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CIVIL NO.';
  }

  /**
   * Get default court for Wyoming county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court, ${countyName} County, State of Wyoming`;
  }

  /**
   * Generate Wyoming header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF WYOMING';
  }

  /**
   * Generate Wyoming venue — "County of [County]" (title case)
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Wyoming jurisdiction statement — 60-day residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has been a resident of the State of Wyoming for at least sixty (60) days immediately preceding the filing of this Complaint for Divorce. (Wyo. Stat. § 20-2-107)`;
  }

  /**
   * Get Wyoming venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Plaintiff or Defendant resides in ${divorceData.county || '[COUNTY]'} County, Wyoming`;
  }

  /**
   * Generate Wyoming grounds section — no-fault only, irreconcilable differences
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    items.push({
      number: paragraphNum++,
      content: 'There exist irreconcilable differences between the parties, and the marriage should be dissolved. (Wyo. Stat. § 20-2-104)',
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DIVORCE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Wyoming children section — standard custody/visitation terminology
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
        content: 'Plaintiff requests the Court to award custody of the minor child(ren), either joint or sole, in the best interests of the child(ren) pursuant to Wyo. Stat. § 20-2-201.',
        type: 'children_info'
      });

      items.push({
        number: paragraphNum++,
        content: 'Plaintiff requests the Court to establish a reasonable visitation schedule for the non-custodial parent pursuant to Wyo. Stat. § 20-2-202.',
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
   * Generate Wyoming property section — equitable distribution per Wyo. Stat. § 20-2-114
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Plaintiff requests that the Court equitably divide the marital property and debts pursuant to Wyo. Stat. § 20-2-114.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Each party is entitled to their separate property, being property acquired before the marriage or acquired during the marriage by gift or inheritance.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Wyoming relief section — uses Wyoming-specific terminology
   * "Decree of Divorce," "alimony," standard custody/visitation, child support per Wyo. Stat. § 20-2-304
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
      'Enter a Decree of Divorce dissolving the marriage of the parties;',
      'Equitably divide the marital property and debts pursuant to Wyo. Stat. § 20-2-114;',
      'Confirm each party\'s separate property;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award custody of the minor child(ren), joint or sole, in the best interests of the child(ren) pursuant to Wyo. Stat. § 20-2-201;');
      reliefItems.push('Establish a reasonable visitation schedule for the non-custodial parent pursuant to Wyo. Stat. § 20-2-202;');
      reliefItems.push('Order child support in accordance with the Wyoming Child Support Guidelines, Wyo. Stat. § 20-2-304;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff pursuant to Wyo. Stat. § 20-2-114;');
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
   * Get Wyoming verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Wyoming that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform Wyoming-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Wyoming Complaint for Divorce');
    }

    warnings.push('Wyoming requires 60 days residency in the state before filing. (Wyo. Stat. § 20-2-107)');
    warnings.push('A Decree of Divorce cannot be entered until at least 20 days after the Complaint is filed. (Wyo. Stat. § 20-2-108)');
    warnings.push('Wyoming is a no-fault only state. The sole ground is irreconcilable differences. (Wyo. Stat. § 20-2-104)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A Parenting Plan and Child Support Worksheet are required for all cases involving minor children.');
      warnings.push('Child support must be calculated using the Wyoming Child Support Guidelines (Wyo. Stat. § 20-2-304).');
    }

    return { errors, warnings };
  }
}

module.exports = WyomingDivorcePetitionTemplate;
