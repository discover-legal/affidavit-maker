// templates/states/california/DivorcePetitionTemplate.js
// California-specific divorce petition template (FL-100)
// Complies with California Family Code and California Rules of Court

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * California Petition for Dissolution of Marriage Template (FL-100)
 *
 * Legal References:
 * - California Family Code Division 6 (Nullity, Dissolution, and Legal Separation)
 * - California Family Code § 2310-2313 (Grounds)
 * - California Family Code § 2330-2334 (Procedure)
 * - California Code of Civil Procedure § 2015.5 (Declarations)
 * - California Rules of Court, Rule 5.12 (Format of papers)
 *
 * California-Specific Notes:
 * - 6-month residency requirement (state) + 3-month (county)
 * - 6-month mandatory waiting period (longest in US)
 * - Community property state
 * - Uses "Dissolution of Marriage" not "Divorce"
 */
class CaliforniaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'CA';
    this.stateName = 'California';
    this.documentTitle = 'PETITION FOR DISSOLUTION OF MARRIAGE';
    this.formNumber = 'FL-100';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // California-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate',
      'separationDate' // California requires date of separation
    ];

    // California residency requirements
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 90, // 3 months
      description: 'You must be a California resident for 6 months AND a resident of the county where you file for 3 months before filing.'
    };

    // California waiting period (longest in US)
    this.waitingPeriod = {
      days: 180, // 6 months
      startsFrom: 'service_date',
      exceptions: [],
      description: 'A divorce cannot be finalized until at least 6 months after the respondent is served. No exceptions.'
    };

    // California formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * Get California case number label
   * @returns {string} "Case Number:"
   */
  getCaseNumberLabel() {
    return 'Case Number:';
  }

  /**
   * Get default court for California county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    return `Superior Court of California, County of ${county || '[COUNTY]'}`;
  }

  /**
   * Generate California-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'SUPERIOR COURT OF CALIFORNIA';
  }

  /**
   * Generate California-style venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    return `COUNTY OF ${(county || '[COUNTY]').toUpperCase()}`;
  }

  /**
   * Get California jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been a resident of the State of California for at least six months and of ${divorceData.county || '[COUNTY]'} County for at least three months immediately preceding the filing of this Petition. (Family Code § 2320)`;
  }

  /**
   * Get California venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner resides in this county`;
  }

  /**
   * Generate California marriage information section
   * Includes separation date (required in California)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Marriage information section
   */
  generateMarriageInformationSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 5;

    items.push({
      number: paragraphNum++,
      content: `Petitioner and Respondent were married on ${this.formatDate(divorceData.marriageDate) || '[DATE OF MARRIAGE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}.`,
      type: 'marriage_info'
    });

    // California requires date of separation
    items.push({
      number: paragraphNum++,
      content: `The parties separated on or about ${this.formatDate(divorceData.separationDate) || '[DATE OF SEPARATION]'}.`,
      type: 'marriage_info'
    });

    items.push({
      number: paragraphNum++,
      content: `The marriage has become irretrievably broken due to irreconcilable differences. (Family Code § 2310(a))`,
      type: 'marriage_info'
    });

    return {
      title: 'III. MARRIAGE INFORMATION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate California grounds section
   * California only allows irreconcilable differences or incurable insanity
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    items.push({
      number: paragraphNum++,
      content: `Irreconcilable differences have caused the irremediable breakdown of the marriage. (Family Code § 2310(a))`,
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DISSOLUTION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate California children section with FL-105 reference
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: `No children were born or adopted of this marriage, and none are expected.`,
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: `The minor children of this marriage are as listed. A completed Declaration Under Uniform Child Custody Jurisdiction and Enforcement Act (UCCJEA) (Form FL-105) is attached.`,
        type: 'children_info'
      });

      if (divorceData.children && Array.isArray(divorceData.children)) {
        divorceData.children.forEach(child => {
          const name = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
          const birthDate = typeof child === 'object' && child.birthDate ? this.formatDate(child.birthDate) : '[BIRTH DATE]';
          items.push({
            number: paragraphNum++,
            content: `${name}, born ${birthDate}`,
            type: 'child_detail'
          });
        });
      }
    }

    return {
      title: 'V. MINOR CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate California property section (community property state)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 14;

    items.push({
      number: paragraphNum++,
      content: `Petitioner and Respondent will agree to a division of community property and debts, or alternatively, Petitioner requests the Court to determine rights to community and quasi-community assets and debts.`,
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: `There exists community property owned by the parties, the nature and extent of which will be proven at trial or set forth in a Property Declaration (Form FL-160).`,
      type: 'property_info'
    });

    if (divorceData.hasSeparateProperty !== false) {
      items.push({
        number: paragraphNum++,
        content: `Petitioner requests the Court to confirm separate property to each party as their sole and separate property.`,
        type: 'property_request'
      });
    }

    return {
      title: 'VI. PROPERTY',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate California relief section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'Petitioner prays that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [];

    reliefItems.push('Grant a dissolution of the marriage and all other relief requested in this petition;');
    reliefItems.push('Divide the community property equally between the parties (Family Code § 2550);');
    reliefItems.push('Confirm each party\'s separate property to that party;');

    // Add child-related relief if applicable
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine custody and visitation of the minor child(ren) in their best interests;');
      reliefItems.push('Order child support per the California Statewide Uniform Guideline (Family Code § 4050-4076);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Order spousal support from Respondent to Petitioner (Family Code § 4320);');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Each party to pay their own attorney fees and costs, unless the Court determines otherwise (Family Code § 2030);');
    reliefItems.push('Grant such other and further relief as the Court deems just and proper.');

    reliefItems.forEach((relief, index) => {
      const letter = String.fromCharCode(97 + index); // a, b, c format
      items.push({
        number: null,
        content: relief,
        type: 'relief_item',
        style: 'letter',
        letter: letter
      });
    });

    return {
      title: 'PRAYER',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get California verification text (Declaration under penalty of perjury per CCP § 2015.5)
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';

    return `I declare under penalty of perjury under the laws of the State of California that the foregoing is true and correct.

Date: ___________________

_________________________________
${name}
(SIGNATURE OF PETITIONER)`;
  }

  /**
   * Perform California-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // California requires county
    if (!divorceData.county) {
      errors.push('County is required for California dissolution petitions');
    }

    // California requires date of separation
    if (!divorceData.separationDate) {
      errors.push('Date of separation is required for California dissolution petitions');
    }

    // Warning about 6-month waiting period
    warnings.push('California has a mandatory 6-month waiting period. Your divorce cannot be finalized until at least 6 months after Respondent is served.');

    // Warning about financial disclosure
    warnings.push('California requires mandatory financial disclosure (FL-140, FL-142, FL-150). You must serve these on the other party.');

    // Children warning
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('You must complete and attach Declaration Under UCCJEA (Form FL-105) when minor children are involved.');
    }

    return { errors, warnings };
  }
}

module.exports = CaliforniaDivorcePetitionTemplate;
