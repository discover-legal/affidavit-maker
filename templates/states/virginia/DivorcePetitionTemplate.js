// templates/states/virginia/DivorcePetitionTemplate.js
// Virginia-specific Bill of Complaint for Divorce template
// Complies with Va. Code § 20-91 et seq.

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Virginia Bill of Complaint for Divorce Template
 *
 * Legal References:
 * - Va. Code § 20-91 (Grounds for divorce from the bond of matrimony)
 * - Va. Code § 20-91(9)(a) (6-month separation: no children + separation agreement)
 * - Va. Code § 20-91(9)(b) (1-year separation: general)
 * - Va. Code § 20-97 (Residency requirement — 6 months domicile)
 * - Va. Code § 20-98 (Venue)
 * - Va. Code § 20-107.1 (Spousal support and maintenance)
 * - Va. Code § 20-107.3 (Equitable distribution — marital vs. separate property)
 * - Va. Code § 20-107.4 (Name change upon divorce)
 * - Va. Code § 20-108.2 (Child support guidelines)
 * - Va. Code § 20-124.1 et seq. (Child custody)
 *
 * Virginia-Specific Notes:
 * - Document is called "BILL OF COMPLAINT FOR DIVORCE" (equity court tradition)
 * - Filed in Virginia Circuit Court
 * - Case number label: "CASE NO."
 * - Header: "IN THE CIRCUIT COURT OF [COUNTY/CITY], VIRGINIA"
 * - 6-month domicile/residency required
 * - Two no-fault grounds: 6-month separation (no children + agreement)
 *   or 1-year separation (general)
 * - Fault grounds include adultery (may bar alimony to the adulterous spouse)
 * - Equitable distribution state; separate property vs. marital property distinction
 * - "Complainant" / "Defendant" terminology (equity practice)
 * - Virginia has independent cities — court is Circuit Court of County or City
 */
class VirginiaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'VA';
    this.stateName = 'Virginia';
    this.documentTitle = 'BILL OF COMPLAINT FOR DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Virginia-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate',
      'groundsForDivorce'
    ];

    // Virginia residency requirements (Va. Code § 20-97)
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 0,
      description: 'One of the parties must have been domiciled in Virginia, or been a bona fide resident of Virginia, for at least six months immediately preceding the filing of the suit.'
    };

    // Virginia waiting period depends on circumstances
    this.waitingPeriod = {
      days: 180, // Minimum — 6 months with agreement, no children
      startsFrom: 'separation_date',
      description: '6 months separation required if no minor children and parties have a signed separation agreement (§ 20-91(9)(a)). Otherwise, 1 year separation required (§ 20-91(9)(b)).'
    };

    // Virginia formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * Get Virginia case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Virginia county or independent city
   * Virginia Circuit Court handles divorce matters (Va. Code § 20-97, § 20-98)
   * Virginia has both counties and independent cities — court name differs for each
   * Format: "Circuit Court of [County] County, Virginia"
   *     or: "Circuit Court of the City of [City], Virginia"
   * @param {string} county - County or independent city name
   * @returns {string} Court name including "Virginia"
   */
  getDefaultCourt(county) {
    const jurisdictionName = county || '[COUNTY/CITY]';
    const upper = jurisdictionName.toUpperCase();
    if (upper.startsWith('CITY OF')) {
      return `CIRCUIT COURT OF THE ${upper}, VIRGINIA`;
    }
    return `CIRCUIT COURT OF ${upper} COUNTY, VIRGINIA`;
  }

  /**
   * Generate Virginia-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'COMMONWEALTH OF VIRGINIA';
  }

  /**
   * Generate Virginia venue
   * Virginia has both counties and independent cities
   * @param {string} county - County or city name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const upper = (county || '[COUNTY]').toUpperCase();
    if (upper.startsWith('CITY OF')) {
      return upper;
    }
    return `COUNTY OF ${upper}`;
  }

  /**
   * Generate Virginia case caption
   * Virginia equity tradition uses "Complainant" and "Defendant"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    // getDefaultCourt() already includes ", VIRGINIA" — do not append it again
    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);

    caption += `IN THE ${courtName.toUpperCase()}\n\n`;

    // Case number — Virginia uses "CASE NO."
    caption += `CASE NO. ${divorceData.caseNumber || '____________________'}\n\n`;

    // Virginia uses Complainant/Defendant (equity court tradition)
    const petitioner = (divorceData.petitionerName || '[COMPLAINANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    caption += `${petitioner},\n`;
    caption += `     Complainant,\n\n`;
    caption += `v.\n\n`;
    caption += `${respondent},\n`;
    caption += `     Defendant.\n\n`;

    caption += this.documentTitle;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Virginia jurisdiction statement
   * Virginia uses "domicile" language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const petitioner = divorceData.petitionerName || 'Complainant';
    const county = divorceData.county || '[COUNTY/CITY]';
    return `${petitioner} is and has been domiciled in the Commonwealth of Virginia for a period of more than six (6) months immediately preceding the commencement of this suit, satisfying the jurisdictional requirements of Va. Code § 20-97. ${petitioner} resides in ${county}, Virginia.`;
  }

  /**
   * Get venue reason for Virginia
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    const county = divorceData.county || '[COUNTY/CITY]';
    return `the parties last cohabited in ${county}, Virginia, and/or the Complainant resides in ${county}, Virginia, pursuant to Va. Code § 20-98`;
  }

  /**
   * Generate Virginia grounds section
   * Virginia has both no-fault (separation) and fault-based grounds
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const groundsText = this.getGroundsText(divorceData.groundsForDivorce || 'separation_1yr', divorceData);

    items.push({
      number: paragraphNum++,
      content: groundsText,
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DIVORCE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Get Virginia grounds text
   * @param {string} grounds - Grounds code
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    const separationDate = divorceData.separationDate
      ? this.formatDate(divorceData.separationDate)
      : '[DATE OF SEPARATION]';

    switch (grounds) {
      case 'separation_6mo':
        return `The parties have lived separate and apart without any cohabitation and without interruption since on or about ${separationDate}, a period in excess of six (6) months. There are no minor children born of or adopted during this marriage, and the parties have entered into a separation agreement resolving all matters. Complainant seeks a divorce from the bond of matrimony pursuant to Va. Code § 20-91(9)(a).`;

      case 'separation_1yr':
      case 'separation':
        return `The parties have lived separate and apart without any cohabitation and without interruption since on or about ${separationDate}, a period in excess of one (1) year. Complainant seeks a divorce from the bond of matrimony pursuant to Va. Code § 20-91(9)(b).`;

      case 'adultery':
        return 'Defendant has been guilty of adultery committed since the marriage, pursuant to Va. Code § 20-91(1). Complainant seeks a divorce from the bond of matrimony on the ground of adultery.';

      case 'felony':
        return 'Defendant has been convicted of a felony subsequent to the marriage, has been sentenced to confinement for more than one year, and is confined pursuant to such sentence, pursuant to Va. Code § 20-91(2)-(4). Complainant seeks a divorce from the bond of matrimony on the ground of felony conviction.';

      case 'cruelty_desertion':
        return `Defendant has been guilty of cruelty and caused reasonable apprehension of bodily hurt to Complainant and/or willfully deserted and abandoned Complainant since on or about ${separationDate}, and such desertion has continued for more than one year, pursuant to Va. Code § 20-91(6). Complainant seeks a divorce from the bond of matrimony on the ground of cruelty and/or desertion.`;

      default:
        return `The parties have lived separate and apart without any cohabitation and without interruption since on or about ${separationDate}, a period in excess of one (1) year, pursuant to Va. Code § 20-91(9)(b).`;
    }
  }

  /**
   * Generate Virginia children section
   * Uses "Legal Custody" and "Physical Custody" terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 10;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children born of or adopted during this marriage.',
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
        const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) : null;
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
        content: 'Complainant requests that the Court enter appropriate orders regarding legal and physical custody of the minor child(ren) in the best interests of the child(ren), pursuant to Va. Code § 20-124.1 et seq.',
        type: 'custody_request'
      });

      items.push({
        number: paragraphNum++,
        content: 'Complainant requests that the Court enter an order of child support in accordance with the Virginia Child Support Guidelines, Va. Code § 20-108.2.',
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
   * Generate Virginia property section
   * Virginia distinguishes between marital and separate property
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 13;

    items.push({
      number: paragraphNum++,
      content: 'During the marriage, the parties acquired marital property, including real property, personal property, and financial accounts. The parties may also have separate property from before the marriage or acquired by gift or inheritance.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Complainant requests that the Court classify all property as marital, separate, or hybrid property and make an equitable distribution of the marital property pursuant to Va. Code § 20-107.3.',
      type: 'property_request'
    });

    items.push({
      number: paragraphNum++,
      content: 'Complainant requests that the Court equitably allocate responsibility for the marital debts of the parties.',
      type: 'debt_request'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Virginia relief section
   * Uses Virginia-specific terminology for spousal support and custody
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Complainant respectfully prays that this Court:',
      type: 'relief_intro'
    });

    const reliefItems = [];

    reliefItems.push('Enter a Final Decree of Divorce dissolving the bonds of matrimony between Complainant and Defendant, from the bond of matrimony, pursuant to Va. Code § 20-91;');
    reliefItems.push('Classify all property as marital, separate, or hybrid property and equitably distribute the marital property pursuant to Va. Code § 20-107.3;');
    reliefItems.push('Equitably allocate marital debts between the parties;');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine legal and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to Va. Code § 20-124.1 et seq.;');
      reliefItems.push('Establish a visitation schedule for the non-custodial parent;');
      reliefItems.push('Order child support in accordance with the Virginia Child Support Guidelines pursuant to Va. Code § 20-108.2;');
      reliefItems.push('Order health insurance coverage for the minor child(ren);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal support to Complainant pursuant to Va. Code § 20-107.1;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Complainant's former name to: ${divorceData.previousName}, pursuant to Va. Code § 20-107.4;`);
    }

    reliefItems.push('Award Complainant the costs of this suit;');
    reliefItems.push('Grant such other and further relief as the Court deems just and equitable.');

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
   * Get Virginia verification text
   * Virginia uses a "sworn" complainant affidavit rather than the PA unsworn verification style
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[COMPLAINANT NAME]';
    return `I, ${name}, Complainant, declare under penalty of perjury that the foregoing is true and correct to the best of my knowledge, information, and belief, pursuant to Va. Code § 18.2-434.

_________________________________
${name}, Complainant

Date: ___________________

COMMONWEALTH OF VIRGINIA
County/City of _______________

Subscribed and sworn to before me this ___ day of _______________, 20___.

_________________________________
Notary Public
My commission expires: ___________
Registration No.: ___________`;
  }

  /**
   * Perform Virginia-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // Virginia requires county
    if (!divorceData.county) {
      errors.push('County or independent city is required for Virginia divorce complaints');
    }

    // Warn about independent cities
    if (divorceData.county && !divorceData.county.toUpperCase().startsWith('CITY OF')) {
      warnings.push('Note: Virginia has independent cities (Richmond, Alexandria, etc.) that are not within any county. If the venue is an independent city, enter "City of [Name]" rather than a county name.');
    }

    // Separation date check for no-fault grounds
    const noFaultGrounds = ['separation_6mo', 'separation_1yr', 'separation'];
    if (!divorceData.groundsForDivorce || noFaultGrounds.includes(divorceData.groundsForDivorce)) {
      if (!divorceData.separationDate) {
        warnings.push('Date of separation is required for no-fault divorce grounds in Virginia.');
      } else {
        const separationDate = new Date(divorceData.separationDate);
        const now = new Date();
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const hasChildren = divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0);
        const hasSeparationAgreement = divorceData.hasSeparationAgreement === true;

        if (divorceData.groundsForDivorce === 'separation_6mo') {
          if (hasChildren) {
            errors.push('The 6-month separation ground (Va. Code § 20-91(9)(a)) requires NO minor children. You indicated there are minor children. A 1-year separation is required when there are minor children.');
          }
          if (!hasSeparationAgreement) {
            warnings.push('The 6-month separation ground requires a signed property settlement or separation agreement. Consider using the 1-year separation ground instead.');
          }
          if (separationDate > sixMonthsAgo) {
            errors.push('The 6-month separation requirement has not been met based on the provided separation date.');
          }
        } else {
          if (separationDate > oneYearAgo) {
            errors.push('Virginia requires parties to have lived separate and apart for ONE FULL YEAR before filing under Va. Code § 20-91(9)(b). The parties have not yet been separated for one year based on the provided separation date.');
          }
        }
      }
    }

    // Adultery as grounds — warn about alimony bar
    if (divorceData.groundsForDivorce === 'adultery') {
      warnings.push('Note: If the Complainant commits adultery, the Complainant may be barred from receiving spousal support (Va. Code § 20-107.1). The adultery grounds should be pursued on advice of counsel.');
    }

    // Warn about Affidavit of Complainant for no-fault
    if (!divorceData.groundsForDivorce || noFaultGrounds.includes(divorceData.groundsForDivorce)) {
      warnings.push('Virginia no-fault divorce typically proceeds by affidavit (Affidavit of Complainant) without a court hearing, if uncontested. The affidavit must be taken before a notary public.');
    }

    return { errors, warnings };
  }
}

module.exports = VirginiaDivorcePetitionTemplate;
