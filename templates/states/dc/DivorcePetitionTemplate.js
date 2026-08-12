// templates/states/dc/DivorcePetitionTemplate.js
// District of Columbia Complaint for Divorce template
// Complies with D.C. Code §16-9 (Divorce)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * District of Columbia Complaint for Divorce Template
 *
 * Legal References:
 * - D.C. Code §16-902 — Residency (6 months)
 * - D.C. Code §16-904 — Grounds ("no longer wish to remain married" (Jan 2024), mutual consent, or 6 months living separate)
 * - D.C. Code §16-910 — Property division (equitable distribution)
 * - D.C. Code §16-913 — Alimony
 * - D.C. Code §16-914 — Custody (legal and physical custody, visitation)
 * - D.C. Code §16-916.01 — DC Child Support Guideline
 *
 * DC-Specific Notes:
 * - Called "Complaint for Divorce" (NOT Petition)
 * - Parties: "Plaintiff" and "Defendant"
 * - DC is a federal district, NOT a state — uses "District of Columbia" throughout
 * - No county — single jurisdiction; uses "wards" for internal divisions
 * - Purely no-fault — "no longer wish to remain married" (Jan 2024), mutual consent, or 6 months living separate
 * - 6-month residency requirement
 * - No mandatory waiting period
 * - "Legal Custody" and "Physical Custody"
 * - "Visitation"
 * - "Alimony"
 * - Equitable distribution of marital property
 * - Filed in Superior Court of the District of Columbia, Family Court Division
 * - Case number label: "CASE NO."
 */
class DCDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'DC';
    this.stateName = 'District of Columbia';
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
      'marriageDate',
      'groundsForDivorce'
    ];

    // DC — 6 months residency
    this.residencyRequirements = {
      stateMonths: 6,
      countyMonths: null,
      description: 'At least one party must have been a bona fide resident of the District of Columbia for at least six months before the commencement of the action. (D.C. Code §16-902)'
    };

    // DC — no mandatory waiting period
    this.waitingPeriod = {
      days: 0,
      startsFrom: 'filing_date',
      exceptions: [],
      description: 'DC has no mandatory waiting period after filing. Effective January 26, 2024, a divorce is granted upon the assertion by one or both parties that they no longer wish to remain married (D.C. Code § 16-904(a)); the former mutual-consent and six-month-separation requirements were eliminated.'
    };
  }

  /**
   * Get DC case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for DC — Superior Court, Family Court Division
   * @param {string} county - Not used for DC
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    return 'Superior Court of the District of Columbia, Family Court Division';
  }

  /**
   * Generate DC header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'DISTRICT OF COLUMBIA';
  }

  /**
   * Generate DC venue — "District of Columbia" (no county)
   * @param {string} county - Not used for DC
   * @returns {string} Venue text
   */
  generateVenue(county) {
    return 'District of Columbia';
  }

  /**
   * Get DC jurisdiction statement — 6-month residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has been a bona fide resident of the District of Columbia for at least six (6) months immediately preceding the filing of this Complaint. This Court has jurisdiction over this matter pursuant to D.C. Code §16-902.`;
  }

  /**
   * Get DC venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return 'Plaintiff or Defendant resides in the District of Columbia';
  }

  /**
   * Generate DC grounds section — no-fault only (mutual consent or 6-month separation)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'no_longer_wish';

    if (grounds === 'no_longer_wish' || grounds === 'no_fault') {
      items.push({
        number: paragraphNum++,
        content: 'Plaintiff states under oath that Plaintiff no longer wishes to remain married. (D.C. Code §16-904(a), effective January 26, 2024)',
        type: 'grounds'
      });
    } else if (grounds === 'living_separate' || grounds === 'separation') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have been living separate and apart without cohabitation for at least six (6) months. (D.C. Code §16-904(b))',
        type: 'grounds'
      });
    } else if (grounds === 'mutual_consent') {
      items.push({
        number: paragraphNum++,
        content: 'Both parties mutually and voluntarily consent to the divorce. (D.C. Code §16-904(a))',
        type: 'grounds'
      });
    } else {
      // Default to the new primary ground
      items.push({
        number: paragraphNum++,
        content: 'Plaintiff states under oath that Plaintiff no longer wishes to remain married. (D.C. Code §16-904(a), effective January 26, 2024)',
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
   * Generate DC children section — uses "legal custody" and "physical custody"
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
        content: 'Plaintiff requests the Court to determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to D.C. Code §16-914, and to establish a visitation schedule for the non-custodial parent.',
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
   * Generate DC property section — equitable distribution of marital property
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Plaintiff requests that the Court divide the marital property and debts equitably pursuant to D.C. Code §16-910.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests the Court to consider all relevant factors including the duration of the marriage, the age, health, occupation, and earning capacity of each party, the contribution of each party to the acquisition, preservation, and appreciation of property, and any other factor the Court deems just and proper.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate DC relief section — uses DC-specific terminology
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
      'Enter a Judgment of Absolute Divorce;',
      'Divide the marital property and debts equitably pursuant to D.C. Code §16-910;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to D.C. Code §16-914;');
      reliefItems.push('Establish a visitation schedule for the non-custodial parent;');
      reliefItems.push('Order child support in accordance with the DC Child Support Guideline, D.C. Code §16-916.01;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff pursuant to D.C. Code §16-913;');
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
   * Get DC verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the District of Columbia that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform DC-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // DC has no county requirement — it is a single jurisdiction
    warnings.push('DC requires 6 months of residency before filing. (D.C. Code §16-902)');
    warnings.push('DC is a purely no-fault jurisdiction. As of January 2024, the primary ground is "no longer wish to remain married" (no separation required). Mutual consent and 6-month separation are also available.');
    warnings.push('DC uses "Complaint for Divorce" with "Plaintiff" and "Defendant" terminology.');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('Child support must be calculated using the DC Child Support Guideline (D.C. Code §16-916.01).');
    }

    return { errors, warnings };
  }
}

module.exports = DCDivorcePetitionTemplate;
