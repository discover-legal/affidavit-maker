// templates/states/maine/DivorcePetitionTemplate.js
// Maine Complaint for Divorce template
// Complies with 19-A M.R.S. §901 et seq. (Divorce)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Maine Complaint for Divorce Template
 *
 * Legal References:
 * - 19-A M.R.S. §901 — Jurisdiction and residency (6 months or married in ME or grounds arose in ME)
 * - 19-A M.R.S. §902 — Grounds (no-fault only — irreconcilable marital differences); 60-day waiting period
 * - 19-A M.R.S. §953 — Division of marital property (equitable distribution)
 * - 19-A M.R.S. §951-A — Spousal support (general, transitional, reimbursement, nominal)
 * - 19-A M.R.S. §1501 et seq. — Parental rights and responsibilities (Maine's term for custody)
 * - 19-A M.R.S. §2001 et seq. — Maine Child Support Guidelines
 *
 * Maine-Specific Notes:
 * - No-fault only state — "irreconcilable marital differences"
 * - 6-month residency (or married in ME, or grounds arose in ME)
 * - 60-day waiting period from service
 * - UNIQUE: "Parental Rights and Responsibilities" (NOT "custody")
 * - UNIQUE: "Parent-Child Contact" (NOT "visitation")
 * - "Spousal Support" — 4 types: general, transitional, reimbursement, nominal
 * - Equitable distribution of marital property
 * - Filed in District Court, Family Division
 * - Case number label: "DOCKET NO." or "FM-[number]"
 * - Parties: "Plaintiff" and "Defendant"
 */
class MaineDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'ME';
    this.stateName = 'Maine';
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

    // Maine — 6 months state residency (or married in ME, or grounds arose in ME)
    this.residencyRequirements = {
      stateMonths: 6,
      countyMonths: 0,
      description: 'Either spouse must have been a resident of Maine for at least 6 months before filing; or the parties were married in Maine and one party still resides there; or the grounds for divorce arose in Maine. (19-A M.R.S. §901)'
    };

    // Maine waiting period — 60 days from service
    this.waitingPeriod = {
      days: 60,
      startsFrom: 'service',
      exceptions: [],
      description: 'No judgment of divorce may be entered until at least 60 days after service of the summons and complaint on the defendant. (19-A M.R.S. §902)'
    };
  }

  /**
   * Get Maine case number label — "DOCKET NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'DOCKET NO.';
  }

  /**
   * Get default court for Maine county — District Court, Family Division
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court, Family Division, ${countyName} County, Maine`;
  }

  /**
   * Generate Maine header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MAINE';
  }

  /**
   * Generate Maine venue — title case per Maine practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Maine jurisdiction statement — 6-month state residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has been a resident of the State of Maine for at least six (6) months immediately preceding the filing of this Complaint. (19-A M.R.S. §901)`;
  }

  /**
   * Get Maine venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Plaintiff or Defendant resides in ${divorceData.county || '[COUNTY]'} County, Maine`;
  }

  /**
   * Generate Maine grounds section — no-fault only (irreconcilable marital differences)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    items.push({
      number: paragraphNum++,
      content: 'There exist irreconcilable marital differences between the parties. (19-A M.R.S. §902)',
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DIVORCE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Maine children section — uses "Parental Rights and Responsibilities"
   * and "Parent-Child Contact" (Maine's unique terminology)
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
        content: 'Plaintiff requests the Court to allocate parental rights and responsibilities for the minor child(ren) in the best interests of the child(ren) pursuant to 19-A M.R.S. §1501 et seq., and to establish a parent-child contact schedule.',
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
   * Generate Maine property section — equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Plaintiff requests that the Court divide the marital property and debts equitably pursuant to 19-A M.R.S. §953.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests the Court to consider the contribution of each spouse to the acquisition of marital property (including homemaking), the value of each spouse\'s non-marital property, the economic circumstances of each party, and the length of the marriage.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Maine relief section — uses Maine-specific terminology
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
      'Enter a Judgment of Divorce dissolving the marriage of the parties;',
      'Divide the marital property and debts equitably pursuant to 19-A M.R.S. §953;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Allocate parental rights and responsibilities for the minor child(ren) in the best interests of the child(ren) pursuant to 19-A M.R.S. §1501 et seq.;');
      reliefItems.push('Establish a parent-child contact schedule;');
      reliefItems.push('Order child support in accordance with the Maine Child Support Guidelines, 19-A M.R.S. §2001 et seq.;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal support to Plaintiff pursuant to 19-A M.R.S. §951-A;');
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
   * Get Maine verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Maine that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform Maine-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Maine divorce complaints');
    }

    warnings.push('Maine requires 6 months of state residency before filing (or married in ME, or grounds arose in ME). (19-A M.R.S. §901)');
    warnings.push('No judgment may be entered until 60 days after service of the summons and complaint. (19-A M.R.S. §902)');
    warnings.push('Maine is a no-fault only state. The sole ground is irreconcilable marital differences. (19-A M.R.S. §902)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A proposed order on parental rights and responsibilities must be filed.');
      warnings.push('Child support must be calculated using the Maine Child Support Guidelines (19-A M.R.S. §2001 et seq.).');
      warnings.push('Maine uses "parental rights and responsibilities" instead of "custody" and "parent-child contact" instead of "visitation."');
    }

    return { errors, warnings };
  }
}

module.exports = MaineDivorcePetitionTemplate;
