// templates/states/arizona/DivorcePetitionTemplate.js
// Arizona-specific divorce petition template
// Complies with Arizona Revised Statutes Title 25 and Arizona Rules of Family Law Procedure

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Arizona Petition for Dissolution of Marriage Template
 *
 * Legal References:
 * - Arizona Revised Statutes Title 25 (Marital and Domestic Relations)
 * - A.R.S. § 25-311 through 25-319 (Dissolution of Marriage)
 * - Arizona Rules of Family Law Procedure
 *
 * Official Forms:
 * - DRDA10f: Petition for Dissolution without Children
 * - DRDC15f: Petition for Dissolution with Minor Children
 * - DR11f: Summons
 * - DR14f: Preliminary Injunction (required with ALL filings)
 *
 * Formatting Requirements:
 * - 8.5" x 11" paper
 * - 2" top margin on first page, 1.5" on subsequent pages
 * - 1" left margin, 0.5" right margin, 0.5" bottom margin
 * - 14-point proportionally spaced serif font (e.g., Times New Roman)
 * - Double-spaced
 *
 * Arizona-Specific Requirements:
 * - 90-day state residency
 * - 60-day waiting period from service
 * - Preliminary Injunction required with ALL divorce filings
 * - Uses "Dissolution of Marriage" not "Divorce"
 */
class ArizonaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'AZ';
    this.stateName = 'Arizona';
    this.documentTitle = 'PETITION FOR DISSOLUTION OF MARRIAGE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Arizona-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate'
    ];

    // Arizona residency requirements
    this.residencyRequirements = {
      stateMonths: 0,
      stateDays: 90,
      countyDays: 0,
      description: 'At least one spouse must have been domiciled in Arizona for at least 90 days before filing.'
    };

    // Arizona waiting period
    this.waitingPeriod = {
      days: 60,
      startsFrom: 'service_date',
      exceptions: [],
      description: 'The court may not enter a decree of dissolution until 60 days after service of the petition and summons.'
    };

    // Arizona formatting requirements
    this.formatting = {
      fontSize: '14pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      marginTop: '2in', // First page
      marginTopSubsequent: '1.5in',
      marginBottom: '0.5in',
      marginLeft: '1in',
      marginRight: '0.5in',
      paperSize: '8.5in x 11in'
    };

    // Arizona requires preliminary injunction
    this.sections.preliminaryInjunction = true;
  }

  /**
   * Get Arizona case number label
   * @returns {string} "Case No."
   */
  getCaseNumberLabel() {
    return 'Case No.';
  }

  /**
   * Get default court for Arizona county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    return `Superior Court of Arizona in ${county || '[COUNTY]'} County`;
  }

  /**
   * Generate Arizona-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE SUPERIOR COURT OF THE STATE OF ARIZONA';
  }

  /**
   * Generate Arizona case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    // Petitioner info block (left side)
    caption += `${divorceData.petitionerName || '[PETITIONER NAME]'}\n`;
    caption += `${divorceData.petitionerAddress || '[ADDRESS]'}\n`;
    caption += `${divorceData.petitionerCity || '[CITY]'}, ${divorceData.petitionerState || 'AZ'} ${divorceData.petitionerZip || '[ZIP]'}\n`;
    caption += `Telephone: ${divorceData.petitionerPhone || '[PHONE]'}\n`;
    caption += `Petitioner In Proper Person\n\n`;

    // Court header
    caption += `IN THE SUPERIOR COURT OF THE STATE OF ARIZONA\n`;
    caption += `IN AND FOR THE COUNTY OF ${(divorceData.county || '[COUNTY]').toUpperCase()}\n\n`;

    // Parties and case info
    const petitioner = divorceData.petitionerName || '[PETITIONER NAME]';
    const respondent = divorceData.respondentName || '[RESPONDENT NAME]';

    caption += `In re the Marriage of:\n\n`;
    caption += `${petitioner.toUpperCase()},\n`;
    caption += `     Petitioner,\n\n`;
    caption += `and\n\n`;
    caption += `${respondent.toUpperCase()},\n`;
    caption += `     Respondent.\n\n`;

    // Case number
    caption += `Case No. ${divorceData.caseNumber || '____________________'}\n\n`;

    // Document title
    caption += `PETITION FOR DISSOLUTION OF MARRIAGE\n`;
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      caption += `(Without Minor Children)`;
    } else {
      caption += `(With Minor Children)`;
    }

    return {
      courtName: this.getDefaultCourt(divorceData.county),
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Arizona jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const petitioner = divorceData.petitionerName || 'Petitioner';
    return `${petitioner} has been domiciled in the State of Arizona for at least ninety (90) days immediately before filing this Petition.`;
  }

  /**
   * Get Arizona grounds text
   * Arizona is a no-fault state - only one ground
   * @param {string} grounds - Grounds type
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    // Arizona only has one ground for dissolution
    return 'The marriage between Petitioner and Respondent is irretrievably broken with no reasonable prospect of reconciliation. (A.R.S. § 25-312)';
  }

  /**
   * Generate Arizona children section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children common to the parties, and the wife is not pregnant.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The parties have the following minor child(ren) common to the marriage:',
        type: 'children_info'
      });

      divorceData.children.forEach((child, index) => {
        const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
        const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) : null;
        items.push({
          number: paragraphNum++,
          content: birthDate ? `${childName}, born ${birthDate}` : childName,
          type: 'child_detail'
        });
      });

      // UCCJEA statement
      items.push({
        number: paragraphNum++,
        content: 'The Affidavit Regarding Minor Children (form DRCVG13f) is attached and incorporated by reference.',
        type: 'uccjea'
      });

      // Parenting plan request
      items.push({
        number: paragraphNum++,
        content: 'Petitioner requests that the Court enter a parenting plan that is in the best interests of the child(ren).',
        type: 'custody_request'
      });

      // Parent Information Program
      items.push({
        number: paragraphNum++,
        content: 'Petitioner understands that attendance at the Parent Information Program is required. (A.R.S. § 25-351)',
        type: 'education'
      });
    }

    return {
      title: 'CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Arizona property section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 14;

    items.push({
      number: paragraphNum++,
      content: 'The parties have acquired community property and/or community debts during the marriage.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Petitioner requests that the Court divide the community property and debts equally between the parties. (A.R.S. § 25-318)',
      type: 'property_request'
    });

    return {
      title: 'PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Arizona relief section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Petitioner requests that this Court:',
      type: 'relief_intro'
    });

    const reliefItems = [];

    reliefItems.push('Dissolve the marriage between Petitioner and Respondent;');
    reliefItems.push('Divide the community property and debts equally (A.R.S. § 25-318);');
    reliefItems.push('Confirm each party\'s separate property to that party;');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Enter a parenting plan in the best interests of the minor child(ren);');
      reliefItems.push('Order child support in accordance with the Arizona Child Support Guidelines;');
      reliefItems.push('Order each party to maintain health insurance for the minor child(ren);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal maintenance to Petitioner;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
    }

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
      title: 'PRAYER FOR RELIEF',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get Arizona verification text
   * Arizona petitions must be verified
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    const county = divorceData.county || '[COUNTY]';

    return `STATE OF ARIZONA
COUNTY OF ${county.toUpperCase()}

I, ${name}, the Petitioner in this action, being first duly sworn upon oath, depose and state that I have read the foregoing Petition for Dissolution of Marriage and that the facts stated therein are true and correct to the best of my knowledge and belief.

_________________________________
${name}, Petitioner

SUBSCRIBED AND SWORN to before me this _____ day of _____________, 20___.

_________________________________
Notary Public

My Commission Expires: ___________`;
  }

  /**
   * Perform Arizona-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // Arizona requires county
    if (!divorceData.county) {
      errors.push('County is required for Arizona dissolution petitions');
    }

    // Arizona-specific reminders
    warnings.push('Arizona requires a Preliminary Injunction (DR14f) to be filed with ALL dissolution petitions. This goes into effect upon filing for Petitioner and upon service for Respondent.');

    // Covenant marriage warning
    if (divorceData.covenantMarriage) {
      errors.push('Covenant marriages require different grounds and procedures. Consult an attorney.');
    }

    // Children warning
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('Arizona requires both parents to attend the Parent Information Program (PIP) when minor children are involved.');
      warnings.push('You must complete and attach the Affidavit Regarding Minor Children (DRCVG13f).');
    }

    return { errors, warnings };
  }
}

module.exports = ArizonaDivorcePetitionTemplate;
