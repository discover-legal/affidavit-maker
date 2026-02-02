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
 * Official Forms:
 * - FL-100: Petition—Marriage/Domestic Partnership
 * - FL-110: Summons (Family Law)
 * - FL-115: Proof of Service of Summons
 * - FL-105: Declaration Under UCCJEA (if children)
 *
 * Formatting Requirements (California Rules of Court, Rule 2.100-2.119):
 * - 8.5" x 11" paper
 * - 1" margins (left 1.5" for binding)
 * - 12-point font minimum (proportionally spaced)
 * - Double-spaced text
 * - Page numbers at bottom
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
      marginTop: '1in',
      marginBottom: '0.5in',
      marginLeft: '1.5in', // Extra for binding
      marginRight: '0.5in',
      paperSize: '8.5in x 11in',
      pageNumbers: true
    };

    // California uses specific form numbers
    this.relatedForms = {
      petition: 'FL-100',
      summons: 'FL-110',
      proofOfService: 'FL-115',
      response: 'FL-120',
      disclosure: 'FL-140',
      scheduleOfAssets: 'FL-142',
      incomeExpense: 'FL-150',
      uccjea: 'FL-105',
      judgment: 'FL-180'
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
   * Generate California case caption (follows Judicial Council format)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    // Attorney/Self-Rep info (left side header on actual form)
    const petitionerAddress = divorceData.petitionerAddress || '[ADDRESS]\n[CITY, STATE ZIP]';
    const phone = divorceData.petitionerPhone || '[PHONE]';

    caption += `PETITIONER (Self-Represented):\n`;
    caption += `${divorceData.petitionerName || '[PETITIONER NAME]'}\n`;
    caption += `${petitionerAddress}\n`;
    caption += `Telephone: ${phone}\n\n`;

    // Court
    caption += `SUPERIOR COURT OF CALIFORNIA, COUNTY OF ${(divorceData.county || '[COUNTY]').toUpperCase()}\n`;
    caption += `Street Address: ${divorceData.courtAddress || '[COURT ADDRESS]'}\n`;
    caption += `Mailing Address: ${divorceData.courtMailingAddress || '[SAME]'}\n\n`;

    // Case number
    caption += `CASE NUMBER: ${divorceData.caseNumber || '____________________'}\n\n`;

    // Parties
    caption += `PETITIONER: ${(divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase()}\n`;
    caption += `RESPONDENT: ${(divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase()}\n\n`;

    // Form title with number
    caption += `PETITION FOR\n`;
    caption += `☐ Dissolution (Divorce) of: ☒ Marriage ☐ Domestic Partnership\n`;
    caption += `☐ Legal Separation of: ☐ Marriage ☐ Domestic Partnership\n`;
    caption += `☐ Nullity of: ☐ Marriage ☐ Domestic Partnership\n`;
    caption += `                                                    ${this.formNumber}`;

    return {
      courtName: `Superior Court of California, County of ${divorceData.county}`,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate complete California petition following FL-100 structure
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Complete document
   */
  generateDocument(divorceData = {}) {
    const validation = this.validateData(divorceData);
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();

    // California FL-100 specific sections
    const sections = this.generateFL100Sections(divorceData);

    return {
      id,
      state: this.state,
      documentType: this.documentType,
      formNumber: this.formNumber,
      timestamp: new Date(),
      sections,
      fullText: this.generateFullText(sections),
      htmlContent: this.generateHTMLContent(sections),
      validation,
      formatting: this.formatting,
      relatedForms: this.relatedForms
    };
  }

  /**
   * Generate FL-100 specific sections
   * @param {Object} divorceData - Divorce data
   * @returns {Object} All sections
   */
  generateFL100Sections(divorceData) {
    const items = [];

    // Item 1: Residence
    items.push({
      number: 1,
      title: 'RESIDENCE REQUIREMENTS',
      content: this.getResidenceText(divorceData),
      type: 'residence'
    });

    // Item 2: Statistical Facts
    items.push({
      number: 2,
      title: 'STATISTICAL FACTS',
      content: this.getStatisticalFacts(divorceData),
      type: 'statistical'
    });

    // Item 3: Declaration regarding minor children
    items.push({
      number: 3,
      title: 'MINOR CHILDREN',
      content: this.getChildrenDeclaration(divorceData),
      type: 'children'
    });

    // Item 4: Spousal support
    items.push({
      number: 4,
      title: 'SPOUSAL OR DOMESTIC PARTNER SUPPORT',
      content: this.getSpousalSupportRequest(divorceData),
      type: 'support'
    });

    // Item 5: Separate property
    items.push({
      number: 5,
      title: 'SEPARATE PROPERTY',
      content: 'There is separate property to be confirmed or there is no separate property to be confirmed.',
      type: 'property'
    });

    // Item 6: Community and quasi-community property
    items.push({
      number: 6,
      title: 'COMMUNITY AND QUASI-COMMUNITY PROPERTY',
      content: this.getCommunityPropertyText(divorceData),
      type: 'property'
    });

    // Item 7: Legal grounds
    items.push({
      number: 7,
      title: 'LEGAL GROUNDS',
      content: this.getLegalGroundsText(divorceData),
      type: 'grounds'
    });

    // Item 8: Attorney fees
    items.push({
      number: 8,
      title: "ATTORNEY'S FEES",
      content: divorceData.requestAttorneyFees
        ? 'Petitioner requests that the court order Respondent to pay attorney fees and costs.'
        : 'Each party will pay their own attorney fees and costs.',
      type: 'fees'
    });

    return {
      header: this.generateHeader(),
      venue: this.generateVenue(divorceData.county),
      caseCaption: this.generateCaseCaption(divorceData),
      title: this.documentTitle,
      formNumber: this.formNumber,
      items,
      declaration: this.generateDeclaration(divorceData),
      signatureBlock: this.generateSignatureBlock(divorceData.petitionerName),
      footer: this.generateFooter()
    };
  }

  /**
   * Get residence requirement text for Item 1
   * @param {Object} divorceData - Divorce data
   * @returns {string} Residence text
   */
  getResidenceText(divorceData) {
    const county = divorceData.county || '[COUNTY]';
    const petitioner = divorceData.petitionerName || 'Petitioner';

    return `a. ☒ ${petitioner} has been a resident of this state for at least six months and of this county for at least three months immediately preceding the filing of this Petition.\n\n` +
           `b. ☐ We are the same sex, were married in California, and do not live in a state that will dissolve our marriage. This case is filed in the county where we married.`;
  }

  /**
   * Get statistical facts for Item 2
   * @param {Object} divorceData - Divorce data
   * @returns {string} Statistical facts text
   */
  getStatisticalFacts(divorceData) {
    const marriageDate = this.formatDate(divorceData.marriageDate) || '[DATE OF MARRIAGE]';
    const marriagePlace = divorceData.marriageLocation || '[CITY, STATE/COUNTRY]';
    const separationDate = this.formatDate(divorceData.separationDate) || '[DATE OF SEPARATION]';

    return `a. Date of marriage: ${marriageDate}\n` +
           `b. Place of marriage: ${marriagePlace}\n` +
           `c. Date of separation: ${separationDate}\n` +
           `d. Time from date of marriage to date of separation:\n` +
           `   Years: ${divorceData.marriageLengthYears || '___'}  Months: ${divorceData.marriageLengthMonths || '___'}`;
  }

  /**
   * Get children declaration for Item 3
   * @param {Object} divorceData - Divorce data
   * @returns {string} Children declaration text
   */
  getChildrenDeclaration(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return '☒ a. There are no minor children.\n' +
             '☐ b. The minor children are: [N/A]\n' +
             '☐ c. Continued on Attachment 3c.\n' +
             '☐ d. If there are minor children, a completed Declaration Under Uniform Child Custody Jurisdiction and Enforcement Act (UCCJEA) (form FL-105) must be attached.';
    }

    let childrenList = divorceData.children.map((child, index) => {
      const name = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
      const birthDate = typeof child === 'object' && child.birthDate ? this.formatDate(child.birthDate) : '[BIRTH DATE]';
      return `   ${name}, born ${birthDate}`;
    }).join('\n');

    return '☐ a. There are no minor children.\n' +
           '☒ b. The minor children are:\n' +
           childrenList + '\n' +
           '☐ c. Continued on Attachment 3c.\n' +
           '☒ d. If there are minor children, a completed Declaration Under Uniform Child Custody Jurisdiction and Enforcement Act (UCCJEA) (form FL-105) must be attached.';
  }

  /**
   * Get spousal support request for Item 4
   * @param {Object} divorceData - Divorce data
   * @returns {string} Spousal support text
   */
  getSpousalSupportRequest(divorceData) {
    if (divorceData.requestSpousalSupport) {
      return '☒ Petitioner requests spousal support from Respondent.\n' +
             '☐ Respondent requests spousal support from Petitioner.\n' +
             '☐ The court terminate (end) the court\'s ability to award support to Petitioner.\n' +
             '☐ The court terminate (end) the court\'s ability to award support to Respondent.';
    } else if (divorceData.waiveSpousalSupport) {
      return '☐ Petitioner requests spousal support from Respondent.\n' +
             '☐ Respondent requests spousal support from Petitioner.\n' +
             '☒ The court terminate (end) the court\'s ability to award support to Petitioner.\n' +
             '☒ The court terminate (end) the court\'s ability to award support to Respondent.';
    }
    return '☐ Petitioner requests spousal support from Respondent.\n' +
           '☐ Respondent requests spousal support from Petitioner.\n' +
           '☐ The court terminate (end) the court\'s ability to award support to Petitioner.\n' +
           '☐ The court terminate (end) the court\'s ability to award support to Respondent.';
  }

  /**
   * Get community property text for Item 6
   * @param {Object} divorceData - Divorce data
   * @returns {string} Community property text
   */
  getCommunityPropertyText(divorceData) {
    if (divorceData.hasProperty === false) {
      return '☒ There are no such assets or debts that I know of to be divided by the court.';
    }
    return '☐ There are no such assets or debts that I know of to be divided by the court.\n' +
           '☒ Determine rights to community and quasi-community assets and debts. All such assets and debts are listed\n' +
           '   ☐ in Property Declaration (form FL-160).    ☐ in Attachment 6.\n' +
           '   ☒ below (specify):  To be determined';
  }

  /**
   * Get legal grounds text for Item 7
   * @param {Object} divorceData - Divorce data
   * @returns {string} Legal grounds text
   */
  getLegalGroundsText(divorceData) {
    // California only has irreconcilable differences or incurable insanity as grounds
    return '☒ a. Irreconcilable differences (Family Code § 2310(a))\n' +
           '☐ b. Incurable insanity (Family Code § 2310(b))';
  }

  /**
   * Generate California declaration under penalty of perjury
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Declaration section
   */
  generateDeclaration(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    const county = divorceData.county || '[COUNTY]';

    return {
      title: 'DECLARATION',
      text: `I declare under penalty of perjury under the laws of the State of California that the foregoing is true and correct.

Date: ___________________

_________________________________
${name}
(TYPE OR PRINT NAME)                                    (SIGNATURE OF PETITIONER)

☐ Number of pages attached: ___`,
      type: 'declaration'
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

    // California only allows two grounds
    if (divorceData.groundsForDivorce &&
        !['irreconcilable_differences', 'incurable_insanity', 'no_fault'].includes(divorceData.groundsForDivorce)) {
      warnings.push('California only recognizes "irreconcilable differences" or "incurable insanity" as grounds for dissolution.');
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
