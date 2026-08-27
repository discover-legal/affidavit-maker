// templates/states/texas/DivorcePetitionTemplate.js
// Texas-specific divorce petition template
// Complies with Texas Family Code and Texas Rules of Civil Procedure

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Texas Divorce Petition Template
 *
 * Legal References:
 * - Texas Family Code Chapter 6 (Suit for Dissolution of Marriage)
 * - Texas Family Code § 6.301 (General Residency Rule)
 * - Texas Family Code § 6.401 (Waiver of Service)
 * - Texas Rules of Civil Procedure Rule 45, 47
 *
 * Formatting Requirements (Texas Rules of Civil Procedure):
 * - 8.5" x 11" paper
 * - 1" margins on all sides
 * - 12-point font minimum (Times New Roman preferred)
 * - Double-spaced text
 * - Black ink
 *
 * Texas-Specific Terminology:
 * - Uses "CAUSE NO." instead of "CASE NO."
 * - "Insupportability" as no-fault grounds
 * - "Conservatorship" instead of "Custody"
 * - "Managing Conservator" and "Possessory Conservator"
 */
class TexasDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'TX';
    this.stateName = 'Texas';
    this.documentTitle = 'ORIGINAL PETITION FOR DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Texas-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate',
      'groundsForDivorce'
    ];

    // Texas residency requirements
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 90,
      description: 'At least one spouse must have been a domiciliary of Texas for the preceding six-month period and a resident of the county for the preceding 90-day period.'
    };

    // Texas waiting period
    this.waitingPeriod = {
      days: 60,
      exceptions: ['family_violence_conviction', 'protective_order'],
      description: 'The court may not grant a divorce before the 60th day after the date the suit was filed. Exceptions apply for family violence.'
    };

    // Texas formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2', // Double-spaced
      margin: '1in',
      paperSize: '8.5in x 11in'
    };

    // Texas-specific sections
    this.sections.standingOrders = true; // Some counties require standing orders
    this.sections.civilCaseInformation = true; // Civil Case Information Sheet
    this.sections.vitalStatistics = true; // Bureau of Vital Statistics form
  }

  /**
   * Get Texas case number label
   * @returns {string} "CAUSE NO."
   */
  getCaseNumberLabel() {
    return 'CAUSE NO.';
  }

  /**
   * Get default court for Texas county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `${this.getCourtType(county)} COURT OF ${countyUpper} COUNTY, TEXAS`;
  }

  /**
   * Determine court type based on county population
   * Most family law cases in Texas go to District Court
   * @param {string} county - County name
   * @returns {string} Court type
   */
  getCourtType(county) {
    // In Texas, family law cases typically go to District Court
    // Some counties have specific family district courts
    return 'DISTRICT';
  }

  /**
   * Generate Texas-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'THE STATE OF TEXAS';
  }

  /**
   * Generate Texas-style venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate Texas case caption with proper formatting
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    // Court name
    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `IN THE ${courtName.toUpperCase()}\n\n`;

    // Texas uses "CAUSE NO." - leave blank for clerk to assign
    const causeNumber = divorceData.caseNumber || '____________________';
    caption += `CAUSE NO. ${causeNumber}\n\n`;

    // Texas style of cause for divorce
    caption += `IN THE MATTER OF\n`;
    caption += `THE MARRIAGE OF\n\n`;

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    caption += `${petitioner}\n`;
    caption += `Petitioner,\n\n`;

    caption += `AND\n\n`;

    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    caption += `${respondent}\n`;
    caption += `Respondent`;

    // Add children section to caption if applicable
    if (divorceData.hasMinorChildren === true && divorceData.children && divorceData.children.length > 0) {
      caption += `\n\nAND IN THE INTEREST OF\n`;
      divorceData.children.forEach((child, index) => {
        const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
        caption += `${childName.toUpperCase()}${index < divorceData.children.length - 1 ? ',' : ''}\n`;
      });
      caption += `MINOR CHILD${divorceData.children.length > 1 ? 'REN' : ''}`;
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
   * Generate Texas jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been a domiciliary of the State of Texas for at least six months and a resident of ${divorceData.county || '[COUNTY]'} County, Texas, for at least ninety days immediately preceding the filing of this suit.`;
  }

  /**
   * Generate Texas venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner is a resident of this county`;
  }

  /**
   * Get Texas grounds text
   * Texas uses "insupportability" as the no-fault ground
   * @param {string} grounds - Grounds type
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    switch (grounds) {
      case 'insupportability':
      case 'irreconcilable_differences':
      case 'no_fault':
        return 'The marriage of Petitioner and Respondent has become insupportable because of discord or conflict of personalities that destroys the legitimate ends of the marital relationship and prevents any reasonable expectation of reconciliation.';

      case 'cruelty':
        return 'Respondent was guilty of cruel treatment toward Petitioner of such a nature as to render further living together insupportable.';

      case 'adultery':
        return 'Respondent committed adultery.';

      case 'conviction':
        return `Respondent has been convicted of a felony during the marriage, has been imprisoned for at least one year in the Texas Department of Criminal Justice, a federal penitentiary, or the penitentiary of another state, and has not been pardoned.`;

      case 'abandonment':
        return `Respondent left Petitioner with the intention of abandonment, and Respondent remained away for at least one year.`;

      case 'living_apart':
        return `Petitioner and Respondent have lived apart without cohabitation for at least three years.`;

      case 'confinement':
        return `Respondent has been confined in a state mental hospital or private mental hospital for at least three years and it appears that the mental disorder is of such a degree and nature that adjustment is unlikely or that, if adjustment occurs, relapse is probable.`;

      default:
        return 'The marriage of Petitioner and Respondent has become insupportable because of discord or conflict of personalities that destroys the legitimate ends of the marital relationship and prevents any reasonable expectation of reconciliation.';
    }
  }

  /**
   * Generate Texas children section with conservatorship language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'No children were born or adopted of this marriage, and none are expected.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following children were born or adopted of this marriage:',
        type: 'children_info'
      });

      if (divorceData.children && divorceData.children.length > 0) {
        divorceData.children.forEach((child, index) => {
          const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
          const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) : null;
          const childInfo = birthDate ? `${childName}, born ${birthDate}` : childName;

          items.push({
            number: paragraphNum++,
            content: `Child ${index + 1}: ${childInfo}`,
            type: 'child_detail'
          });
        });
      }

      items.push({
        number: paragraphNum++,
        content: 'No other children were born to or adopted by Petitioner and Respondent during the marriage, the wife is not pregnant, and none are expected.',
        type: 'children_info'
      });

      // Texas conservatorship language
      items.push({
        number: paragraphNum++,
        content: 'It is in the best interest of the child(ren) that Petitioner and Respondent be appointed Joint Managing Conservators of the child(ren).',
        type: 'conservatorship_request'
      });

      items.push({
        number: paragraphNum++,
        content: 'Petitioner requests the Court to determine the rights and duties of each parent and periods of possession and access that are in the best interest of the child(ren).',
        type: 'conservatorship_request'
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
   * Generate Texas property section with community property language
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
    let paragraphNum = divorceData._paragraphNum || 14;

    if (divorceData.hasProperty === false && divorceData.hasDebts === false) {
      items.push({
        number: paragraphNum++,
        content: 'There is no community property or community debt to be divided.',
        type: 'property_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'Petitioner and Respondent will agree to a division of their estate, or alternatively, Petitioner requests the Court to order a division of the estate of the parties in a manner that the Court deems just and right, as provided by law.',
        type: 'property_request'
      });

      // Texas community property presumption
      items.push({
        number: paragraphNum++,
        content: 'There exists community property owned by the parties, the nature and extent of which will be proven at trial or set forth in an agreement of the parties.',
        type: 'property_info'
      });
    }

    return {
      title: 'VI. PROPERTY',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Texas relief section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'Petitioner prays that citation and notice issue as required by law and that the Court grant a divorce and all other relief requested in this petition.',
      type: 'relief_intro'
    });

    items.push({
      number: null,
      content: 'Petitioner prays that the Court grant the following relief:',
      type: 'relief_intro'
    });

    const reliefItems = [];

    // Divorce
    reliefItems.push('Divorce and a dissolution of the marriage of Petitioner and Respondent;');

    // Property division
    reliefItems.push('Division of the community estate in a manner that the Court deems just and right, with due regard for the rights of each party;');

    // Children
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Appointment of conservators and determination of the rights and duties of each conservator;');
      reliefItems.push('Determination of periods of possession and access to the child(ren);');
      reliefItems.push('Child support as provided by law;');
      reliefItems.push('Medical support and dental support for the child(ren);');
    }

    // Spousal support
    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Spousal maintenance as provided by law;');
    }

    // Name change
    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Change of name of ${divorceData.nameChangeParty || 'Petitioner'} to ${divorceData.previousName};`);
    }

    // General relief
    reliefItems.push('Attorney\'s fees, expenses, interest, and costs of court;');
    reliefItems.push('Such other and further relief, general and special, to which Petitioner may be justly entitled.');

    // Agreed corollary relief (agreed support amount, spousal-support

    // waiver, property agreement) — spliced before the final general prayer.

    this.appendAgreedReliefItems(reliefItems, divorceData);


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
   * Get Texas verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    const county = divorceData.county || '[COUNTY]';

    return `STATE OF TEXAS
COUNTY OF ${county.toUpperCase()}

BEFORE ME, the undersigned authority, on this day personally appeared ${name}, known to me to be the Petitioner in the above-entitled and numbered cause, who being duly sworn, stated on oath that the facts set forth in the foregoing Original Petition for Divorce are within the personal knowledge of Petitioner and are true and correct.

_________________________________
${name}, Petitioner

SWORN TO AND SUBSCRIBED before me on _____________________, 20___.

_________________________________
Notary Public, State of Texas

My commission expires: _______________`;
  }

  /**
   * Perform Texas-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // Texas requires county
    if (!divorceData.county || divorceData.county.trim().length === 0) {
      errors.push('County is required for Texas divorce petitions');
    }

    // Texas-specific grounds validation
    const validGrounds = [
      'insupportability', 'irreconcilable_differences', 'no_fault',
      'cruelty', 'adultery', 'conviction', 'abandonment',
      'living_apart', 'confinement'
    ];

    if (divorceData.groundsForDivorce && !validGrounds.includes(divorceData.groundsForDivorce)) {
      warnings.push(`"${divorceData.groundsForDivorce}" may not be a recognized ground in Texas. Consider using "insupportability" for no-fault divorce.`);
    }

    // Warning about children
    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    // Warning about property
    if (!divorceData.hasProperty && divorceData.hasProperty !== false) {
      warnings.push('Property information not specified. Please indicate whether there is community property to divide.');
    }

    return { errors, warnings };
  }
}

module.exports = TexasDivorcePetitionTemplate;
