// templates/states/illinois/DivorcePetitionTemplate.js
// Illinois-specific divorce petition template
// Complies with 750 ILCS 5 (Illinois Marriage and Dissolution of Marriage Act)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Illinois Petition for Dissolution of Marriage Template
 *
 * Legal References:
 * - 750 ILCS 5 (Illinois Marriage and Dissolution of Marriage Act)
 * - 750 ILCS 5/401 (Dissolution of Marriage)
 * - 750 ILCS 5/501(a)(1) (Financial Affidavit requirement)
 * - Illinois Supreme Court Rules
 *
 * Official Forms:
 * - Statewide Approved Standardized Forms (required)
 * - Petition for Dissolution of Marriage (No Children)
 * - Petition for Dissolution of Marriage (With Children)
 * - Financial Affidavit
 * - Certificate of Dissolution (IDPH form)
 *
 * Formatting Requirements:
 * - 8.5" x 11" paper
 * - 1" margins
 * - 12-point font
 * - Double-spaced
 *
 * Illinois-Specific Notes:
 * - 90-day residency requirement (can be established before or after filing, but before judgment)
 * - No mandatory waiting period; however, 6 months separation creates a rebuttable presumption of irreconcilable differences
 * - Both parties may waive the 6-month separation period by written stipulation (750 ILCS 5/401(a))
 * - Financial Affidavit mandatory per statute (750 ILCS 5/501(a)(1))
 * - Irreconcilable differences is ONLY ground for dissolution (since January 1, 2016)
 */
class IllinoisDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'IL';
    this.stateName = 'Illinois';
    this.documentTitle = 'PETITION FOR DISSOLUTION OF MARRIAGE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Illinois-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate'
    ];

    // Illinois residency requirements
    this.residencyRequirements = {
      stateMonths: 0,
      stateDays: 90,
      countyDays: 0,
      description: 'One or both parties must have been Illinois residents for 90 days before judgment (can be established after filing).'
    };

    // Illinois waiting period
    this.waitingPeriod = {
      days: 0,
      exceptions: [],
      description: 'Illinois has no mandatory waiting period, but residency must be established before judgment.'
    };

    // Illinois formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * Get Illinois case number label
   * @returns {string} "Case No."
   */
  getCaseNumberLabel() {
    return 'Case No.';
  }

  /**
   * Get default court for Illinois county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    return `Circuit Court of ${county || '[COUNTY]'} County, Illinois`;
  }

  /**
   * Generate Illinois-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE CIRCUIT COURT OF ILLINOIS';
  }

  /**
   * Generate Illinois case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    // Court
    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `${courtName.toUpperCase()}\n\n`;

    // Parties
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
    caption += this.documentTitle;
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      caption += '\n(No Minor Children)';
    } else {
      caption += '\n(With Minor Children)';
    }

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Illinois jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const petitioner = divorceData.petitionerName || 'Petitioner';

    if (divorceData.bothResidents) {
      return `Both ${petitioner} and Respondent have been residents of the State of Illinois for more than 90 days. ${petitioner} has been a resident of ${divorceData.county || '[COUNTY]'} County, Illinois.`;
    }
    return `${petitioner} has been a resident of the State of Illinois for more than 90 days and is a resident of ${divorceData.county || '[COUNTY]'} County, Illinois.`;
  }

  /**
   * Get Illinois grounds text
   * Illinois is a pure no-fault state with only irreconcilable differences
   * @param {string} grounds - Grounds type
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    // Illinois ONLY allows irreconcilable differences as of 2016
    return 'Irreconcilable differences have caused the irretrievable breakdown of the marriage, and the court determines that efforts at reconciliation have failed or that future attempts at reconciliation would be impracticable and not in the best interests of the family. (750 ILCS 5/401(a))';
  }

  /**
   * Generate Illinois children section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children born or adopted of this marriage.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The parties are the parents of the following minor child(ren):',
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

      // Illinois allocation of parental responsibilities
      items.push({
        number: paragraphNum++,
        content: 'Petitioner requests that the Court allocate parental responsibilities, including significant decision-making responsibilities and parenting time, in the best interests of the child(ren).',
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
   * Generate Illinois property section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 14;

    items.push({
      number: paragraphNum++,
      content: 'During the marriage, the parties have acquired marital property and may have incurred marital debts.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Petitioner requests that the Court make an equitable distribution of the marital and non-marital property.',
      type: 'property_request'
    });

    // Illinois requires Financial Affidavit
    items.push({
      number: paragraphNum++,
      content: 'A Financial Affidavit is being filed with this Petition as required by 750 ILCS 5/501(a)(1).',
      type: 'financial_disclosure'
    });

    return {
      title: 'PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Illinois relief section
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

    reliefItems.push('Enter a Judgment of Dissolution of Marriage dissolving the marriage between Petitioner and Respondent;');
    reliefItems.push('Make an equitable division of the marital property and debts;');
    reliefItems.push('Award each party their non-marital property;');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Allocate parental responsibilities and parenting time in the best interests of the minor child(ren);');
      reliefItems.push('Order child support in accordance with the Illinois Child Support Guidelines;');
      reliefItems.push('Order the parties to maintain health insurance for the minor child(ren);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award maintenance (spousal support) to Petitioner;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other and further relief as the Court deems just and equitable.');

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
   * Get Illinois verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';

    return `Under penalties as provided by law pursuant to Section 1-109 of the Code of Civil Procedure, the undersigned certifies that the statements set forth in this instrument are true and correct, except as to matters therein stated to be on information and belief, and as to such matters the undersigned certifies as aforesaid that the undersigned verily believes the same to be true.

_________________________________
${name}, Petitioner

Date: ___________________`;
  }

  /**
   * Perform Illinois-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // Illinois requires county
    if (!divorceData.county) {
      errors.push('County is required for Illinois dissolution petitions');
    }

    // Illinois requires Financial Affidavit
    warnings.push('Illinois requires a Financial Affidavit to be filed with the Petition per 750 ILCS 5/501(a)(1).');

    // Certificate of Dissolution reminder
    warnings.push('A Certificate of Dissolution must be filed with the Illinois Department of Public Health per 750 ILCS 5/707.');

    // Illinois-specific grounds reminder
    if (divorceData.groundsForDivorce && divorceData.groundsForDivorce !== 'irreconcilable_differences') {
      warnings.push('Illinois only recognizes "irreconcilable differences" as a ground for dissolution. All other fault-based grounds were eliminated in 2016.');
    }

    return { errors, warnings };
  }
}

module.exports = IllinoisDivorcePetitionTemplate;
