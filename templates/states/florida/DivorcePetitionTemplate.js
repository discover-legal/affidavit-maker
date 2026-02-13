// templates/states/florida/DivorcePetitionTemplate.js
// Florida-specific divorce petition template
// Complies with Florida Statutes Chapter 61 and Florida Family Law Rules of Procedure

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Florida Petition for Dissolution of Marriage Template
 *
 * Legal References:
 * - Florida Statutes Chapter 61 (Dissolution of Marriage; Support; Time-Sharing)
 * - Florida Family Law Rules of Procedure
 * - Florida Supreme Court Approved Family Law Forms
 *
 * Official Forms:
 * - Form 12.901(a): Joint Petition for Simplified Dissolution
 * - Form 12.901(b)(1): Petition for Dissolution with Minor Children
 * - Form 12.901(b)(2): Petition for Dissolution with Property, No Minor Children
 * - Form 12.901(b)(3): Petition for Dissolution No Property, No Minor Children
 * - Form 12.902(b): Family Law Financial Affidavit (Short Form)
 * - Form 12.902(c): Family Law Financial Affidavit (Long Form)
 *
 * Formatting Requirements:
 * - 8.5" x 11" paper
 * - 1" margins
 * - 12-point font
 * - Double-spaced
 *
 * Florida-Specific Notes:
 * - 6-month residency requirement
 * - Simplified dissolution has NO waiting period
 * - Regular dissolution has no mandatory waiting period
 */
class FloridaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'FL';
    this.stateName = 'Florida';
    this.documentTitle = 'PETITION FOR DISSOLUTION OF MARRIAGE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Florida-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate'
    ];

    // Florida residency requirements
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 0,
      description: 'At least one spouse must have been a Florida resident for at least 6 months before filing.'
    };

    // Florida waiting period (none for simplified)
    this.waitingPeriod = {
      days: 0,
      exceptions: [],
      description: 'Florida has no mandatory waiting period. Simplified dissolutions can be finalized approximately 30 days after filing.'
    };

    // Florida formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };

    // Florida form numbers
    this.formNumbers = {
      simplified: '12.901(a)',
      withChildren: '12.901(b)(1)',
      withPropertyNoChildren: '12.901(b)(2)',
      noPropertyNoChildren: '12.901(b)(3)'
    };
  }

  /**
   * Get appropriate Florida form number based on case type
   * @param {Object} divorceData - Divorce data
   * @returns {string} Form number
   */
  getFormNumber(divorceData) {
    if (divorceData.simplified) {
      return this.formNumbers.simplified;
    }
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      return this.formNumbers.withChildren;
    }
    if (divorceData.hasProperty === true) {
      return this.formNumbers.withPropertyNoChildren;
    }
    return this.formNumbers.noPropertyNoChildren;
  }

  /**
   * Get Florida case number label
   * @returns {string} "Case No.:"
   */
  getCaseNumberLabel() {
    return 'Case No.:';
  }

  /**
   * Get default court for Florida county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    return `Circuit Court of the ${this.getJudicialCircuit(county)} Judicial Circuit, in and for ${county || '[COUNTY]'} County, Florida`;
  }

  /**
   * Get judicial circuit number for Florida county
   * @param {string} county - County name
   * @returns {string} Circuit number
   */
  getJudicialCircuit(county) {
    // Florida has 20 judicial circuits
    // This would need to be expanded with a full county-to-circuit mapping
    const circuitMap = {
      'Miami-Dade': '11th',
      'Broward': '17th',
      'Palm Beach': '15th',
      'Hillsborough': '13th',
      'Orange': '9th',
      'Duval': '4th',
      'Pinellas': '6th'
    };
    return circuitMap[county] || '[CIRCUIT]';
  }

  /**
   * Generate Florida-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE CIRCUIT COURT OF THE STATE OF FLORIDA';
  }

  /**
   * Generate Florida case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    // Court
    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `IN THE ${courtName.toUpperCase()}\n\n`;

    // Case number
    caption += `Case No.: ${divorceData.caseNumber || '____________________'}\n`;
    caption += `Division: ${divorceData.division || 'Family'}\n\n`;

    // Parties
    const petitioner = divorceData.petitionerName || '[PETITIONER NAME]';
    const respondent = divorceData.respondentName || '[RESPONDENT NAME]';

    caption += `In re: The Marriage of\n\n`;
    caption += `${petitioner.toUpperCase()},\n`;
    caption += `     Petitioner,\n\n`;
    caption += `and\n\n`;
    caption += `${respondent.toUpperCase()},\n`;
    caption += `     Respondent.\n`;
    caption += `_________________________________/\n\n`;

    // Form number
    caption += `${this.documentTitle}\n`;
    caption += `Florida Supreme Court Approved Family Law Form ${this.getFormNumber(divorceData)}`;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Florida jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const petitioner = divorceData.petitionerName || 'Petitioner';
    const respondent = divorceData.respondentName || 'Respondent';

    if (divorceData.bothResidents) {
      return `${petitioner} and ${respondent} have both been residents of Florida for more than 6 months before the filing of this Petition for Dissolution of Marriage.`;
    }
    return `${petitioner} has been a resident of the State of Florida for more than 6 months before the filing of this Petition for Dissolution of Marriage.`;
  }

  /**
   * Get Florida grounds text
   * Florida is a pure no-fault state
   * @param {string} grounds - Grounds type
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    if (grounds === 'mental_incapacity') {
      return 'Respondent has been adjudged mentally incapacitated for a period of 3 years prior to the filing of this petition. (Florida Statutes § 61.052(1)(b))';
    }
    return 'The marriage between the parties is irretrievably broken. (Florida Statutes § 61.052(1)(a))';
  }

  /**
   * Generate Florida children section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children common to the parties.',
        type: 'children_info'
      });

      if (divorceData.wifePregnant === false) {
        items.push({
          number: paragraphNum++,
          content: 'The wife is not pregnant.',
          type: 'children_info'
        });
      }
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The minor child(ren) common to the parties are:',
        type: 'children_info'
      });

      divorceData.children.forEach((child, index) => {
        const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
        const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate) : null;
        items.push({
          number: paragraphNum++,
          content: birthDate ? `${childName}, born ${birthDate}` : childName,
          type: 'child_detail'
        });
      });

      // UCCJEA
      items.push({
        number: paragraphNum++,
        content: 'A completed Uniform Child Custody Jurisdiction and Enforcement Act (UCCJEA) Affidavit, Florida Supreme Court Approved Family Law Form 12.902(d), is filed with this petition.',
        type: 'uccjea'
      });

      // Parenting Plan
      items.push({
        number: paragraphNum++,
        content: 'Petitioner requests that the Court establish or approve a Parenting Plan for the minor child(ren) that includes provisions for time-sharing and parental responsibility.',
        type: 'custody_request'
      });
    }

    return {
      title: 'CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Florida relief section
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

    const reliefItems = [];

    reliefItems.push('Grant a dissolution of the marriage between Petitioner and Respondent;');
    reliefItems.push('Equitably distribute the marital assets and liabilities between the parties;');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Establish or approve a Parenting Plan that includes time-sharing and parental responsibility for the minor child(ren);');
      reliefItems.push('Order child support pursuant to the child support guidelines in Florida Statutes § 61.30;');
      reliefItems.push('Order each party to maintain health insurance for the minor child(ren);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Petitioner;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other relief as the Court deems just and proper.');

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
      title: 'PRAYER FOR RELIEF',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get Florida verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';

    return `I understand that I am swearing or affirming under oath to the truthfulness of the claims made in this petition and that the punishment for knowingly making a false statement includes fines and/or imprisonment.

Dated: ___________________

_________________________________
Signature of Petitioner
${name}
Printed Name

STATE OF FLORIDA
COUNTY OF ____________________

Sworn to or affirmed and signed before me on _____________ by ______________________.

_________________________________
NOTARY PUBLIC or DEPUTY CLERK

[Print, type, or stamp commissioned name of notary or deputy clerk.]

___ Personally known
___ Produced identification
Type of identification produced: ___________________`;
  }

  /**
   * Perform Florida-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // Florida requires county
    if (!divorceData.county) {
      errors.push('County is required for Florida dissolution petitions');
    }

    // Check simplified dissolution eligibility
    if (divorceData.simplified) {
      if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
        errors.push('Simplified dissolution is not available when there are minor children');
      }
      if (divorceData.wifePregnant === true) {
        errors.push('Simplified dissolution is not available if the wife is pregnant');
      }
      if (divorceData.requestSpousalSupport) {
        errors.push('Simplified dissolution is not available when alimony is requested');
      }
    }

    // Financial affidavit reminder
    if (divorceData.hasMinorChildren === true || divorceData.requestSpousalSupport || divorceData.hasProperty) {
      warnings.push('Florida requires a Family Law Financial Affidavit (Form 12.902(b) for income under $50,000 or Form 12.902(c) for income $50,000 or more).');
    }

    // Children warning
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('You must complete and file a UCCJEA Affidavit (Form 12.902(d)) when minor children are involved.');
      warnings.push('Florida requires a Parenting Plan (Form 12.995(a)) when minor children are involved.');
    }

    return { errors, warnings };
  }
}

module.exports = FloridaDivorcePetitionTemplate;
