// templates/states/nebraska/DivorcePetitionTemplate.js
// Nebraska Complaint for Dissolution of Marriage template
// Complies with Neb. Rev. Stat. §42-347 et seq. (Dissolution of Marriage)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Nebraska Complaint for Dissolution of Marriage Template
 *
 * Legal References:
 * - Neb. Rev. Stat. §42-347 et seq. — Dissolution of Marriage
 * - Neb. Rev. Stat. §42-349 — Residency requirement (1 year state or 1 year military)
 * - Neb. Rev. Stat. §42-361 — Grounds (no-fault only — irretrievably broken)
 * - Neb. Rev. Stat. §42-363 — no hearing until 60 days after perfection of service
 * - Neb. Rev. Stat. §42-365 — Property division and alimony (equitable distribution)
 * - Neb. Rev. Stat. §42-364 — Child custody and parenting time
 * - Neb. Rev. Stat. §42-364.16 — Nebraska Child Support Guidelines
 *
 * Nebraska-Specific Notes:
 * - Called "Dissolution of Marriage"
 * - No-fault only state — "irretrievably broken" is the sole ground
 * - 1-year state residency (or 1-year military stationing) required
 * - 60-day waiting period from filing or service (whichever is later)
 * - "Legal Custody" and "Physical Custody"
 * - "Parenting Time"
 * - "Alimony" (Neb. Rev. Stat. §42-365)
 * - Equitable distribution
 * - Filed in District Court
 * - Case number label: "CASE NO." or "CI [number]"
 * - Parties: "Petitioner"/"Respondent" or "Plaintiff"/"Defendant"
 */
class NebraskaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'NE';
    this.stateName = 'Nebraska';
    this.documentTitle = 'COMPLAINT FOR DISSOLUTION OF MARRIAGE';

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

    // Nebraska — 1 year state residency
    this.residencyRequirements = {
      stateMonths: 12,
      countyMonths: 0,
      description: 'At least one party must have been a bona fide resident of Nebraska for at least one year, or stationed in Nebraska as a member of the military for one year, immediately preceding the filing. (Neb. Rev. Stat. §42-349)'
    };

    // Nebraska waiting period — 60 days from filing or service
    this.waitingPeriod = {
      days: 60,
      startsFrom: 'filing_or_service',
      exceptions: [],
      description: 'No hearing may be held and no decree entered until at least 60 days after perfection of service of process. (Neb. Rev. Stat. §42-363)'
    };
  }

  /**
   * Get Nebraska case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Nebraska county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court of ${countyName} County, Nebraska`;
  }

  /**
   * Generate Nebraska header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF NEBRASKA';
  }

  /**
   * Generate Nebraska venue — title case per Nebraska practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Nebraska jurisdiction statement — 1-year state residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has been a bona fide resident of the State of Nebraska for at least one (1) year immediately preceding the filing of this Complaint. (Neb. Rev. Stat. §42-349)`;
  }

  /**
   * Get Nebraska venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Plaintiff or Defendant resides in ${divorceData.county || '[COUNTY]'} County, Nebraska`;
  }

  /**
   * Generate Nebraska grounds section — no-fault only (irretrievably broken)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    items.push({
      number: paragraphNum++,
      content: 'The marriage of the parties is irretrievably broken. (Neb. Rev. Stat. §42-361)',
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DISSOLUTION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Nebraska children section — uses "legal custody" and "physical custody"
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
        content: 'Plaintiff requests the Court to determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to Neb. Rev. Stat. §42-364, and to establish a parenting time schedule.',
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
   * Generate Nebraska property section — equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Plaintiff requests that the Court divide the marital property and debts equitably pursuant to Neb. Rev. Stat. §42-365.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests the Court to consider the contributions of each spouse to the acquisition of property, the duration of the marriage, the circumstances of the parties, and any other relevant factors in making an equitable division.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Nebraska relief section — uses Nebraska-specific terminology
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
      'Enter a Decree of Dissolution of Marriage;',
      'Divide the marital property and debts equitably pursuant to Neb. Rev. Stat. §42-365;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to Neb. Rev. Stat. §42-364;');
      reliefItems.push('Establish a parenting time schedule;');
      reliefItems.push('Order child support in accordance with the Nebraska Child Support Guidelines, Neb. Rev. Stat. §42-364.16;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff pursuant to Neb. Rev. Stat. §42-365;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Plaintiff's former name to: ${divorceData.previousName};`);
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
   * Get Nebraska verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Nebraska that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform Nebraska-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Nebraska dissolution complaints');
    }

    warnings.push('Nebraska requires 1 year of state residency (or 1 year of military stationing) before filing. (Neb. Rev. Stat. §42-349)');
    warnings.push('No hearing may be held until 60 days after perfection of service of process. (Neb. Rev. Stat. §42-363)');
    warnings.push('Nebraska is a no-fault only state. The sole ground is that the marriage is irretrievably broken. (Neb. Rev. Stat. §42-361)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A parenting plan must be filed with the court.');
      warnings.push('Child support must be calculated using the Nebraska Child Support Guidelines (Neb. Rev. Stat. §42-364.16).');
    }

    return { errors, warnings };
  }
}

module.exports = NebraskaDivorcePetitionTemplate;
