// templates/states/north_carolina/DivorcePetitionTemplate.js
// North Carolina-specific Complaint for Absolute Divorce template
// Complies with N.C.G.S. § 50-1 et seq.

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * North Carolina Complaint for Absolute Divorce Template
 *
 * Legal References:
 * - N.C.G.S. § 50-6 (Divorce after one year's separation)
 * - N.C.G.S. § 50-3 (Venue)
 * - N.C.G.S. § 50-8 (Residency — 6 months)
 * - N.C.G.S. § 50-11 (Effect of divorce judgment)
 * - N.C.G.S. § 50-20 (Equitable distribution — separate proceeding)
 * - N.C.G.S. § 50-13.1 (Custody — separate proceeding)
 * - N.C.G.S. § 50-13.4 (Child support — separate proceeding)
 * - N.C.G.S. § 50-16.1A (Alimony — separate proceeding)
 * - N.C.G.S. § 50-16.2A (Post-separation support)
 *
 * North Carolina-Specific Notes:
 * - ONLY ground for divorce: one-year separation (§ 50-6)
 * - Separation of one year BEFORE filing is required — not a waiting period after filing
 * - Document is "COMPLAINT FOR ABSOLUTE DIVORCE"
 * - Case number label: "FILE NO."
 * - Court: General Court of Justice, District Court Division
 * - CRITICAL: Equitable distribution, alimony, and custody claims must be filed
 *   BEFORE the divorce is granted or rights are permanently waived
 * - 6-month residency in state required
 */
class NorthCarolinaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'NC';
    this.stateName = 'North Carolina';
    this.documentTitle = 'COMPLAINT FOR ABSOLUTE DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // North Carolina-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate',
      'separationDate' // Required — NC requires proof of one-year separation
    ];

    // North Carolina residency requirements (N.C.G.S. § 50-8)
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 0,
      description: 'One of the parties must have been a North Carolina resident for at least six months immediately before filing.'
    };

    // NC has no waiting period after filing — the one-year separation IS the ground
    this.waitingPeriod = {
      days: 0,
      startsFrom: 'filing_date',
      description: 'No waiting period after filing. However, parties must have already lived separate and apart for ONE YEAR before the complaint is filed. Resuming cohabitation resets the one-year clock.'
    };

    // North Carolina formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * Get North Carolina case number label — "FILE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'FILE NO.';
  }

  /**
   * Get default court for North Carolina county
   * NC divorce is heard in the General Court of Justice, District Court Division
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `GENERAL COURT OF JUSTICE\nDISTRICT COURT DIVISION\n${countyUpper} COUNTY`;
  }

  /**
   * Generate North Carolina header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF NORTH CAROLINA';
  }

  /**
   * Generate North Carolina venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate North Carolina case caption
   * NC uses Plaintiff/Defendant in divorce complaints
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    // North Carolina General Court of Justice
    const countyUpper = (divorceData.county || '[COUNTY]').toUpperCase();
    caption += `STATE OF NORTH CAROLINA\n`;
    caption += `IN THE GENERAL COURT OF JUSTICE\n`;
    caption += `DISTRICT COURT DIVISION\n`;
    caption += `${countyUpper} COUNTY\n\n`;

    // File number
    caption += `FILE NO. ${divorceData.caseNumber || '____________________'}\n\n`;

    // Party names — NC uses Plaintiff/Defendant
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    caption += `${petitioner},\n`;
    caption += `     Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${respondent},\n`;
    caption += `     Defendant.\n\n`;

    caption += this.documentTitle;

    return {
      courtName: `GENERAL COURT OF JUSTICE, DISTRICT COURT DIVISION, ${countyUpper} COUNTY`,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate North Carolina jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const petitioner = divorceData.petitionerName || 'Plaintiff';
    const county = divorceData.county || '[COUNTY]';
    return `${petitioner} has been a resident of the State of North Carolina for at least six (6) months immediately preceding the filing of this Complaint, satisfying the residency requirement of N.C.G.S. § 50-8. ${petitioner} is a resident of ${county} County, North Carolina.`;
  }

  /**
   * Get venue reason for North Carolina
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `the Plaintiff resides in ${divorceData.county || '[COUNTY]'} County, North Carolina, pursuant to N.C.G.S. § 50-3`;
  }

  /**
   * Generate North Carolina grounds section
   * NC has only one practical ground: one-year separation under § 50-6
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const separationDate = divorceData.separationDate
      ? this.formatDate(divorceData.separationDate)
      : '[DATE OF SEPARATION]';

    items.push({
      number: paragraphNum++,
      content: `Plaintiff and Defendant have lived separate and apart without cohabitation since on or about ${separationDate}, a period of more than one (1) year immediately preceding the filing of this Complaint. At least one party intended the separation to be permanent. The parties have not cohabited or resumed the marital relationship during this period. This separation constitutes grounds for absolute divorce pursuant to N.C.G.S. § 50-6.`,
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR ABSOLUTE DIVORCE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Get North Carolina grounds text (override of base method)
   * NC essentially has only one ground: one-year separation
   * @param {string} grounds - Grounds code
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    const separationDate = divorceData.separationDate
      ? this.formatDate(divorceData.separationDate)
      : '[DATE OF SEPARATION]';

    if (grounds === 'incurable_insanity') {
      return 'The parties have lived separate and apart for five (5) years, such separation having been caused by the incurable insanity of the Defendant, pursuant to N.C.G.S. § 50-5.';
    }

    return `Plaintiff and Defendant have lived separate and apart without cohabitation since on or about ${separationDate}, a period in excess of one (1) year, with at least one party intending the separation to be permanent, pursuant to N.C.G.S. § 50-6.`;
  }

  /**
   * Generate North Carolina children section
   * Includes waiver warning — custody claim must be filed before divorce
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 10;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children born of or adopted during this marriage, and no children are expected.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following children were born of or adopted during this marriage:',
        type: 'children_info'
      });

      divorceData.children.forEach((child, index) => {
        const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
        const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate) : null;
        items.push({
          number: paragraphNum++,
          content: birthDate
            ? `${childName}, born ${birthDate}`
            : childName,
          type: 'child_detail'
        });
      });

      items.push({
        number: paragraphNum++,
        content: 'Plaintiff requests that the Court enter appropriate orders regarding child custody and visitation in the best interests of the minor child(ren) pursuant to N.C.G.S. § 50-13.1 et seq.',
        type: 'custody_request'
      });

      items.push({
        number: paragraphNum++,
        content: 'Plaintiff requests that the Court enter an order of child support in accordance with the North Carolina Child Support Guidelines pursuant to N.C.G.S. § 50-13.4.',
        type: 'support_request'
      });
    }

    return {
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate North Carolina property section
   * CRITICAL: Equitable distribution claim must be asserted in complaint or separate action
   * before the divorce is granted, or the right is permanently waived
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 14;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and/or marital debts during the course of the marriage.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff hereby claims and requests equitable distribution of the marital property and divisional property pursuant to N.C.G.S. § 50-20. Plaintiff expressly asserts this claim before entry of the divorce judgment to preserve the right to equitable distribution.',
      type: 'property_request'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate North Carolina relief section
   * Includes statutory warnings about claims that must be raised before divorce is granted
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff respectfully prays the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [];

    reliefItems.push('Grant an Absolute Divorce dissolving the bonds of matrimony between Plaintiff and Defendant, pursuant to N.C.G.S. § 50-6;');
    reliefItems.push('Grant equitable distribution of the marital and divisional property pursuant to N.C.G.S. § 50-20;');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Enter orders establishing custody and visitation of the minor child(ren) pursuant to N.C.G.S. § 50-13.1;');
      reliefItems.push('Enter an order of child support in accordance with the North Carolina Child Support Guidelines pursuant to N.C.G.S. § 50-13.4;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award post-separation support to Plaintiff pursuant to N.C.G.S. § 50-16.2A;');
      reliefItems.push('Award alimony to Plaintiff pursuant to N.C.G.S. § 50-16.1A;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Plaintiff's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Tax the costs of this action to the Defendant;');
    reliefItems.push('Grant such other and further relief as the Court may deem just and proper.');

    reliefItems.forEach((relief, index) => {
      const letter = String.fromCharCode(97 + index); // a, b, c...
      items.push({
        number: null,
        content: relief,
        type: 'relief_item',
        style: 'letter',
        letter
      });
    });

    return {
      title: 'VII. PRAYER FOR RELIEF',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get North Carolina verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, being duly sworn, say that I am the Plaintiff in the above action; that I have read the foregoing Complaint and know the contents thereof; that the same is true of my own knowledge, except those matters therein stated on information and belief, and as to those matters I believe it to be true.

_________________________________
${name}, Plaintiff

Sworn to and subscribed before me this ___ day of _______________, 20___.

_________________________________
Notary Public, North Carolina
My commission expires: ___________`;
  }

  /**
   * Perform North Carolina-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // NC requires county
    if (!divorceData.county) {
      errors.push('County is required for North Carolina divorce complaints');
    }

    // NC requires separation date (one-year separation is the ground)
    if (!divorceData.separationDate) {
      errors.push('Date of separation is required — North Carolina\'s only ground for absolute divorce is one-year separation (N.C.G.S. § 50-6)');
    }

    // Verify separation has been at least one year
    if (divorceData.separationDate) {
      const separationDate = new Date(divorceData.separationDate);
      const now = new Date();
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      if (separationDate > oneYearAgo) {
        errors.push('North Carolina requires parties to have lived separate and apart for ONE FULL YEAR before filing for absolute divorce (N.C.G.S. § 50-6). The parties have not yet been separated for one year based on the provided separation date.');
      }
    }

    // Critical waiver warning
    warnings.push('IMPORTANT: Claims for equitable distribution (property), alimony, and post-separation support MUST be raised before or at the time of the divorce judgment or they are permanently waived (N.C.G.S. §§ 50-20, 50-16.1A).');

    // Service requirement
    warnings.push('The Complaint must be served on the Defendant with a Civil Summons. Defendant has 30 days to respond.');

    return { errors, warnings };
  }
}

module.exports = NorthCarolinaDivorcePetitionTemplate;
