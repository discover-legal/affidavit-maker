// templates/states/tennessee/DivorcePetitionTemplate.js
// Tennessee Complaint for Divorce / Petition for Divorce template
// Complies with TCA Title 36 (Domestic Relations)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Tennessee Divorce Petition Template
 *
 * Legal References:
 * - TCA 36-4-101 — Grounds for divorce (fault and no-fault)
 * - TCA 36-4-104 — Residency requirement (6 months state)
 * - TCA 36-4-121 — Equitable division of marital property
 * - TCA 36-5-121 — Alimony (rehabilitative, transitional, in futuro, in solido)
 * - TCA 36-6-402 — Primary residential parent / alternate residential parent
 * - TCA 36-6-404 — Parenting plan requirement
 * - TCA 36-5-101 — Tennessee Child Support Guidelines
 *
 * Tennessee-Specific Notes:
 * - Called "Divorce" (not dissolution)
 * - "Complaint for Divorce" (fault) or "Petition for Divorce" (irreconcilable differences)
 * - Both no-fault and 13 fault grounds available
 * - For irreconcilable differences: both parties must agree, or 2-year separation with no minor children
 * - 6-month state residency requirement
 * - Waiting period: 60 days (no children), 90 days (minor children) from filing
 * - "Primary Residential Parent" and "Alternate Residential Parent" (not custody)
 * - "Parenting Plan" REQUIRED for cases with minor children
 * - "Alimony" (not maintenance or spousal support) — 4 types
 * - Fault may affect alimony awards
 * - Equitable distribution
 * - Filed in Circuit Court or Chancery Court
 */
class TennesseeDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'TN';
    this.stateName = 'Tennessee';
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

    // Tennessee — 6 months state residency, no county requirement
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 0,
      description: 'At least one spouse must have been a bona fide resident of Tennessee for at least 6 months immediately preceding the filing. (TCA 36-4-104)'
    };

    // Tennessee waiting period — varies by children
    this.waitingPeriod = {
      daysNoChildren: 60,
      daysWithChildren: 90,
      startsFrom: 'filing_date',
      exceptions: [],
      description: 'Waiting period is 60 days (no minor children) or 90 days (minor children) from the date of filing. (TCA 36-4-101(b))'
    };
  }

  /**
   * Get Tennessee case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Tennessee county — Circuit or Chancery Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Circuit Court for ${countyName} County, Tennessee`;
  }

  /**
   * Generate Tennessee header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF TENNESSEE';
  }

  /**
   * Generate Tennessee venue — title case per Tennessee practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Tennessee jurisdiction statement — 6-month state residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has been a bona fide resident of the State of Tennessee for at least six (6) months immediately preceding the filing of this Complaint. (TCA 36-4-104)`;
  }

  /**
   * Get Tennessee venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `The parties last lived together in ${divorceData.county || '[COUNTY]'} County, Tennessee, or the Defendant resides in ${divorceData.county || '[COUNTY]'} County`;
  }

  /**
   * Generate Tennessee grounds section — supports both fault and no-fault
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'irreconcilable_differences';

    if (grounds === 'irreconcilable_differences' || grounds === 'no_fault') {
      // Update document title for no-fault
      this.documentTitle = 'PETITION FOR DIVORCE';
      items.push({
        number: paragraphNum++,
        content: 'Irreconcilable differences have developed between the parties making it impossible to continue the marital relationship and which differences cannot be reconciled. Both parties consent to the divorce on the ground of irreconcilable differences. (TCA 36-4-101(a)(13))',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been guilty of adultery. (TCA 36-4-101(a)(4))',
        type: 'grounds'
      });
    } else if (grounds === 'desertion') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been guilty of willful or malicious desertion for one full year without reasonable cause. (TCA 36-4-101(a)(3))',
        type: 'grounds'
      });
    } else if (grounds === 'felony_conviction') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been convicted of a felony and sentenced to confinement in a penitentiary. (TCA 36-4-101(a)(5))',
        type: 'grounds'
      });
    } else if (grounds === 'cruel_treatment') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been guilty of such cruel and inhuman treatment or conduct toward Plaintiff as renders cohabitation unsafe and improper. (TCA 36-4-101(a)(10))',
        type: 'grounds'
      });
    } else if (grounds === 'indignities') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has offered such indignities to Plaintiff as to render Plaintiff\'s position intolerable and thereby forced Plaintiff to withdraw. (TCA 36-4-101(a)(11))',
        type: 'grounds'
      });
    } else if (grounds === 'two_year_separation') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have lived apart without cohabitation for a continuous period of more than two (2) years and there are no minor children of the marriage. (TCA 36-4-101(a)(7))',
        type: 'grounds'
      });
    } else {
      this.documentTitle = 'PETITION FOR DIVORCE';
      items.push({
        number: paragraphNum++,
        content: 'Irreconcilable differences have developed between the parties making it impossible to continue the marital relationship. (TCA 36-4-101(a)(13))',
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
   * Generate Tennessee children section — uses "primary residential parent" / "alternate residential parent"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children born of or adopted during this marriage, and the wife is not now pregnant.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following minor children were born of or adopted during this marriage:',
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
        content: 'Plaintiff requests the Court to designate a primary residential parent and alternate residential parent, and to approve a Permanent Parenting Plan as required by TCA 36-6-404, in the best interests of the child(ren) pursuant to TCA 36-6-106.',
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
   * Generate Tennessee property section — marital property / equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Plaintiff requests that the Court equitably divide the marital property and debts pursuant to TCA 36-4-121.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Each party is entitled to their separate property, being property acquired before the marriage, by gift or inheritance during the marriage, or pain and suffering awards.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Tennessee relief section — uses Tennessee-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff respectfully requests that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Grant the Plaintiff an absolute divorce from the Defendant;',
      'Equitably divide the marital property and debts pursuant to TCA 36-4-121;',
      'Confirm each party\'s separate property;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Approve a Permanent Parenting Plan designating a primary residential parent and alternate residential parent in the best interests of the child(ren) pursuant to TCA 36-6-404;');
      reliefItems.push('Order child support in accordance with the Tennessee Child Support Guidelines, TCA 36-5-101;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff pursuant to TCA 36-5-121;');
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
   * Get Tennessee verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Tennessee that the facts stated in this Complaint/Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform Tennessee-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Tennessee divorce complaints/petitions');
    }

    warnings.push('Tennessee requires 6 months state residency before filing. (TCA 36-4-104)');

    const hasChildren = divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0);
    if (hasChildren) {
      warnings.push('Waiting period is 90 days from filing when minor children are involved. (TCA 36-4-101(b))');
      warnings.push('A Permanent Parenting Plan (TCA 36-6-404) is REQUIRED for all cases involving minor children.');
      warnings.push('Child support must be calculated using the Tennessee Child Support Guidelines (TCA 36-5-101).');
    } else {
      warnings.push('Waiting period is 60 days from filing when no minor children are involved. (TCA 36-4-101(b))');
    }

    const grounds = divorceData.groundsForDivorce || '';
    if (grounds === 'irreconcilable_differences' || grounds === 'no_fault') {
      warnings.push('For irreconcilable differences, both parties must agree to the divorce, or the parties must have lived apart for 2+ years with no minor children.');
    }

    return { errors, warnings };
  }
}

module.exports = TennesseeDivorcePetitionTemplate;
