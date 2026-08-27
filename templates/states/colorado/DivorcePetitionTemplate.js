// templates/states/colorado/DivorcePetitionTemplate.js
// Colorado Petition for Dissolution of Marriage template
// Complies with C.R.S. § 14-10-101 et seq. (Uniform Dissolution of Marriage Act)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Colorado Petition for Dissolution of Marriage Template
 *
 * Legal References:
 * - C.R.S. § 14-10-101 et seq. — Uniform Dissolution of Marriage Act
 * - C.R.S. § 14-10-106 — Grounds and domicile requirement (91 days)
 * - C.R.S. § 14-10-107 — Petition contents and procedure
 * - C.R.S. § 14-10-113 — Disposition of property (equitable distribution)
 * - C.R.S. § 14-10-114 — Maintenance
 * - C.R.S. § 14-10-124 — Best interests of child / parental responsibilities
 * - C.R.S. § 14-10-115 — Child support guidelines (income shares model)
 *
 * Colorado-Specific Notes:
 * - Called "Dissolution of Marriage" — NOT divorce
 * - Pure no-fault state — only ground is "irretrievable breakdown"
 * - 91-day (3-month) domicile requirement (NOT 6 months)
 * - 91-day waiting period from date of service/jurisdiction (C.R.S. § 14-10-106(1)(a))
 * - "Parental Responsibilities" (not custody)
 * - "Parenting Time" (not visitation)
 * - "Maintenance" (not alimony or spousal support)
 * - Equitable distribution (NOT community property)
 * - Filed in District Court
 */
class ColoradoDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'CO';
    this.stateName = 'Colorado';
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

    // Colorado — 91 days domicile (3 months), no county requirement
    this.residencyRequirements = {
      stateMonths: 3,
      countyDays: 0,
      description: 'One of the parties must have been domiciled in Colorado for at least 91 days before filing the petition. (C.R.S. § 14-10-106)'
    };

    // Colorado waiting period — 91 days from service (or co-petitioner joinder)
    this.waitingPeriod = {
      days: 91,
      startsFrom: 'service_date',
      exceptions: [],
      description: 'A decree cannot be entered until 91 days have elapsed after the court acquires jurisdiction over the respondent (via service, waiver of service, or co-petitioner joinder). (C.R.S. § 14-10-106(1)(a))'
    };
  }

  /**
   * Get Colorado case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Colorado county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court, ${countyName} County, Colorado`;
  }

  /**
   * Generate Colorado header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF COLORADO';
  }

  /**
   * Generate Colorado venue — title case per Colorado practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Colorado jurisdiction statement — 91-day domicile
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been domiciled in the State of Colorado for at least ninety-one (91) days immediately preceding the filing of this Petition. (C.R.S. § 14-10-106)`;
  }

  /**
   * Get Colorado venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner or Co-Petitioner/Respondent resides in ${divorceData.county || '[COUNTY]'} County, Colorado`;
  }

  /**
   * Generate Colorado grounds section — irretrievable breakdown only
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    items.push({
      number: paragraphNum++,
      content: 'The marriage of the parties is irretrievably broken. (C.R.S. § 14-10-106(1)(a))',
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DISSOLUTION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Colorado children section — uses "parental responsibilities" and "parenting time"
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
        content: 'Petitioner requests the Court to allocate parental responsibilities, including parenting time and decision-making responsibility, in the best interests of the child(ren) pursuant to C.R.S. § 14-10-124.',
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
   * Generate Colorado property section — marital property / equitable distribution
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
      content: 'The parties have accumulated marital property and debts during the marriage. Petitioner requests that the Court equitably divide the marital property and debts pursuant to C.R.S. § 14-10-113.',
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
   * Generate Colorado relief section — uses Colorado-specific terminology
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
      'Equitably divide the marital property and debts pursuant to C.R.S. § 14-10-113;',
      'Confirm each party\'s separate property;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Allocate parental responsibilities, including parenting time and decision-making, in the best interests of the child(ren) pursuant to C.R.S. § 14-10-124;');
      reliefItems.push('Order child support in accordance with the Colorado Child Support Guidelines, C.R.S. § 14-10-115;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award maintenance to Petitioner pursuant to C.R.S. § 14-10-114;');
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
   * Get Colorado verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Colorado that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
  }

  /**
   * Perform Colorado-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Colorado dissolution petitions');
    }

    warnings.push('Colorado requires 91 days domicile in the state before filing. (C.R.S. § 14-10-106)');
    warnings.push('A decree cannot be entered until 91 days have elapsed after the filing of the petition. (C.R.S. § 14-10-106(1)(f))');
    warnings.push('Colorado is a pure no-fault state. Only ground for dissolution is irretrievable breakdown.');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A Parenting Plan (JDF 1113) is required for all cases involving minor children.');
      warnings.push('Child support must be calculated using the Colorado Child Support Guidelines (JDF 1820).');
    }

    return { errors, warnings };
  }
}

module.exports = ColoradoDivorcePetitionTemplate;
