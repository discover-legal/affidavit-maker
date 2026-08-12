// templates/states/delaware/DivorcePetitionTemplate.js
// Delaware Petition for Divorce template
// Complies with Del. Code tit. 13 (Domestic Relations)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Delaware Petition for Divorce Template
 *
 * Legal References:
 * - Del. Code tit. 13, §1504 — Residency (6 months)
 * - Del. Code tit. 13, §1505 — Grounds (irretrievable breakdown only — no-fault)
 * - Del. Code tit. 13, §1513 — Property division (equitable distribution)
 * - Del. Code tit. 13, §1512 — Alimony
 * - Del. Code tit. 13, §722 — Legal custody and residential arrangements
 * - Del. Code tit. 13, §727 — Visitation rights
 * - Del. Code tit. 13, §514 — Delaware Child Support Formula (Melson Formula)
 * - Del. Code tit. 10, §921 — Family Court jurisdiction
 *
 * Delaware-Specific Notes:
 * - Purely no-fault — "irretrievable breakdown" only
 * - 6-month residency requirement
 * - No mandatory waiting period
 * - "Legal Custody" and "Residential Arrangements" (not "physical custody")
 * - "Visitation"
 * - "Alimony"
 * - Equitable distribution of marital property
 * - Delaware uses the Melson Formula for child support (NOT income shares)
 * - Filed in Family Court
 * - Case number label: "PETITION NO."
 * - Parties: "Petitioner" and "Respondent"
 */
class DelawareDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'DE';
    this.stateName = 'Delaware';
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

    // Delaware — 6 months residency
    this.residencyRequirements = {
      stateMonths: 6,
      countyMonths: null,
      description: 'At least one party must have been a bona fide resident of the State of Delaware for at least six months before the commencement of the proceeding. (Del. Code tit. 13, §1504)'
    };

    // Delaware — no mandatory waiting period
    this.waitingPeriod = {
      days: 0,
      startsFrom: 'filing_date',
      exceptions: [],
      description: 'Delaware has no fixed post-filing waiting period, but no divorce may be decreed until the parties have been separated for six months (13 Del. C. §§ 1503(7), 1507(e)), except where the ground is the respondent\'s misconduct.'
    };
  }

  /**
   * Get Delaware case number label — "PETITION NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'PETITION NO.';
  }

  /**
   * Get default court for Delaware county — Family Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Family Court of the State of Delaware in and for ${countyName} County`;
  }

  /**
   * Generate Delaware header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF DELAWARE';
  }

  /**
   * Generate Delaware venue — title case per Delaware practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Delaware jurisdiction statement — 6-month residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been a bona fide resident of the State of Delaware for at least six (6) months immediately preceding the filing of this Petition. This Court has jurisdiction over this matter pursuant to Del. Code tit. 13, §1504.`;
  }

  /**
   * Get Delaware venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner or Respondent resides in ${divorceData.county || '[COUNTY]'} County, Delaware`;
  }

  /**
   * Generate Delaware grounds section — no-fault only (irretrievable breakdown)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    items.push({
      number: paragraphNum++,
      content: 'The marriage of the parties is irretrievably broken. Reconciliation is improbable. (Del. Code tit. 13, §1505)',
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DIVORCE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Delaware children section — uses "legal custody" and "residential arrangements"
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
        content: 'Petitioner requests the Court to determine legal custody and residential arrangements for the minor child(ren) in the best interests of the child(ren) pursuant to Del. Code tit. 13, §722, and to establish a visitation schedule pursuant to Del. Code tit. 13, §727.',
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
   * Generate Delaware property section — equitable distribution of marital property
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Petitioner requests that the Court divide the marital property and debts equitably pursuant to Del. Code tit. 13, §1513.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Petitioner requests the Court to consider all relevant factors including the length of the marriage, the age and health of each party, the amount and sources of income, the vocational skills and employability of each party, the contribution of each spouse to the acquisition, preservation, or appreciation of property, and whether the property award is in lieu of or in addition to alimony.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Delaware relief section — uses DE-specific terminology
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
      'Grant a Decree of Divorce;',
      'Divide the marital property and debts equitably pursuant to Del. Code tit. 13, §1513;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine legal custody and residential arrangements for the minor child(ren) in the best interests of the child(ren) pursuant to Del. Code tit. 13, §722;');
      reliefItems.push('Establish a visitation schedule for the non-custodial parent pursuant to Del. Code tit. 13, §727;');
      reliefItems.push('Order child support in accordance with the Delaware Child Support Formula (Melson Formula), Del. Code tit. 13, §514;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Petitioner pursuant to Del. Code tit. 13, §1512;');
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
   * Get Delaware verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Delaware that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
  }

  /**
   * Perform Delaware-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Delaware divorce petitions');
    }

    warnings.push('Delaware requires 6 months of residency before filing. (Del. Code tit. 13, §1504)');
    warnings.push('Delaware is a purely no-fault state — only irretrievable breakdown is available as a ground.');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('Child support is calculated using the Delaware Melson Formula (Del. Code tit. 13, §514) — NOT the standard income shares model.');
      warnings.push('Delaware uses "residential arrangements" rather than "physical custody".');
    }

    return { errors, warnings };
  }
}

module.exports = DelawareDivorcePetitionTemplate;
