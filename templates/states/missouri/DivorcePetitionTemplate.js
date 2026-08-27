// templates/states/missouri/DivorcePetitionTemplate.js
// Missouri Petition for Dissolution of Marriage template
// Complies with RSMo Chapter 452 (Dissolution of Marriage)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Missouri Petition for Dissolution of Marriage Template
 *
 * Legal References:
 * - RSMo 452.305 — Commencement of proceedings; 90-day residency; 30-day waiting period
 * - RSMo 452.320 — Grounds for dissolution (irretrievably broken — only ground)
 * - RSMo 452.330 — Disposition of property (equitable distribution)
 * - RSMo 452.335 — Maintenance
 * - RSMo 452.375 — Custody (legal and physical; joint and sole)
 * - RSMo 452.310 — Parenting plan requirement
 * - RSMo 452.340 — Child support guidelines (income shares / Form 14)
 *
 * Missouri-Specific Notes:
 * - Called "Dissolution of Marriage" — NOT divorce
 * - Pure no-fault state — only ground is "irretrievably broken"
 * - 90-day state residency requirement (one of the shortest)
 * - 30-day waiting period from date of filing (one of the shortest)
 * - "Legal Custody" and "Physical Custody"; "Joint" and "Sole"
 * - "Maintenance" (not alimony or spousal support)
 * - Equitable distribution (NOT community property)
 * - Filed in Circuit Court
 * - "Judgment of Dissolution of Marriage" (not Decree)
 */
class MissouriDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'MO';
    this.stateName = 'Missouri';
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

    // Missouri — 90 days state residency, no county requirement
    this.residencyRequirements = {
      stateDays: 90,
      countyDays: 0,
      description: 'At least one party must have been a resident of Missouri for at least 90 days immediately preceding the filing of the petition. (RSMo 452.305)'
    };

    // Missouri waiting period — 30 days from filing
    this.waitingPeriod = {
      days: 30,
      startsFrom: 'filing_date',
      exceptions: [],
      description: 'A judgment cannot be entered until 30 days have elapsed after the filing of the petition. (RSMo 452.305)'
    };
  }

  /**
   * Get Missouri case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Missouri county — Circuit Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Circuit Court of ${countyName} County, Missouri`;
  }

  /**
   * Generate Missouri header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MISSOURI';
  }

  /**
   * Generate Missouri venue — title case per Missouri practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Missouri jurisdiction statement — 90-day state residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been a resident of the State of Missouri for at least ninety (90) days immediately preceding the filing of this Petition. (RSMo 452.305)`;
  }

  /**
   * Get Missouri venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner resides in ${divorceData.county || '[COUNTY]'} County, Missouri`;
  }

  /**
   * Generate Missouri grounds section — irretrievably broken only
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    items.push({
      number: paragraphNum++,
      content: 'The marriage of the parties is irretrievably broken and there remains no reasonable likelihood that the marriage can be preserved. (RSMo 452.320)',
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DISSOLUTION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Missouri children section — uses "legal custody" and "physical custody"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no children born of or adopted during this marriage, and the wife is not now pregnant.',
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
        content: 'Petitioner requests the Court to award custody of the minor child(ren), both legal and physical, and to approve a Parenting Plan as required by RSMo 452.310, in the best interests of the child(ren) pursuant to RSMo 452.375.',
        type: 'children_info'
      });
    }

    // Agreed child arrangements (custody enum, primary residence, agreed
    // support) — pleaded via the base hooks, never silently dropped.
    paragraphNum = this.appendAgreedChildArrangementPleadings(items, paragraphNum, divorceData);

    return {
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Missouri property section — marital property / equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    // An agreed division (or an explicit no-property case) pleads the
    // parties' actual agreement via the base hooks instead of the
    // generic boilerplate.
    if (divorceData.hasProperty === false || this.hasAgreedPropertyDivision(divorceData)) {
      return super.generatePropertySection(divorceData);
    }

    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Petitioner requests that the Court divide the marital property and debts in a just manner pursuant to RSMo 452.330.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Each party is entitled to their non-marital (separate) property, being property acquired before the marriage, by gift or inheritance during the marriage, property acquired after a legal separation, or property excluded by valid agreement.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Missouri relief section — uses Missouri-specific terminology
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
      'Enter a Judgment of Dissolution of Marriage;',
      'Divide the marital property and marital debts in a just manner pursuant to RSMo 452.330;',
      'Set apart to each party their non-marital property;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award custody of the minor child(ren), both legal and physical, and approve a Parenting Plan in the best interests of the child(ren) pursuant to RSMo 452.375;');
      reliefItems.push('Order child support in accordance with the Missouri Child Support Guidelines, Form 14, RSMo 452.340;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award maintenance to Petitioner pursuant to RSMo 452.335;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other and further relief as the Court deems just and proper.');

    // Agreed corollary relief (agreed support amount, spousal-support

    // waiver, property agreement) — spliced before the final general prayer.

    this.appendAgreedReliefItems(reliefItems, divorceData);


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
   * Get Missouri verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Missouri that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
  }

  /**
   * Perform Missouri-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Missouri dissolution petitions');
    }

    warnings.push('Missouri requires 90 days state residency before filing. (RSMo 452.305)');
    warnings.push('A judgment cannot be entered until 30 days have elapsed after filing the petition. (RSMo 452.305)');
    warnings.push('Missouri is a pure no-fault state. Only ground for dissolution is irretrievably broken.');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A Parenting Plan (RSMo 452.310) is required for all cases involving minor children.');
      warnings.push('Child support must be calculated using Form 14, per Missouri Supreme Court Rule 88.01.');
    }

    return { errors, warnings };
  }
}

module.exports = MissouriDivorcePetitionTemplate;
