// templates/states/texas/DivorceDecreeTemplate.js
// Texas-specific final decree of divorce template
// Complies with Texas Family Code and Texas Rules of Civil Procedure

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Texas Final Decree of Divorce Template
 *
 * Legal References:
 * - Texas Family Code Chapter 6 (Suit for Dissolution of Marriage)
 * - Texas Family Code § 6.501 (Waiting Period)
 * - Texas Family Code § 7.001 (Property Division)
 * - Texas Family Code Chapter 153 (Conservatorship, Possession, Access)
 * - Texas Family Code Chapter 154 (Child Support)
 *
 * Formatting Requirements:
 * - 8.5" x 11" paper
 * - 1" margins on all sides
 * - 12-point font minimum
 * - Double-spaced text
 *
 * Texas-Specific Terms:
 * - "CAUSE NO." instead of "CASE NO."
 * - "Conservatorship" instead of "Custody"
 * - "Joint Managing Conservator" / "Sole Managing Conservator"
 * - "Possessory Conservator"
 * - Standard Possession Order (SPO)
 */
class TexasDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'TX';
    this.stateName = 'Texas';
    this.documentTitle = 'FINAL DECREE OF DIVORCE';

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
      'caseNumber',
      'marriageDate'
    ];

    // Texas formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
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
    return `DISTRICT COURT OF ${countyUpper} COUNTY, TEXAS`;
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
   * Generate Texas case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `IN THE ${courtName.toUpperCase()}\n\n`;

    const causeNumber = divorceData.caseNumber || '[CAUSE NUMBER]';
    caption += `CAUSE NO. ${causeNumber}\n\n`;

    caption += `IN THE MATTER OF\n`;
    caption += `THE MARRIAGE OF\n\n`;

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    caption += `${petitioner}\n`;
    caption += `Petitioner,\n\n`;

    caption += `AND\n\n`;

    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    caption += `${respondent}\n`;
    caption += `Respondent`;

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
   * Generate Texas appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `On ${this.formatDate(divorceData.hearingDate) || '___________________'}, this case was called for trial.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `${divorceData.petitionerName || 'Petitioner'} appeared in person${divorceData.petitionerRepresentation === 'attorney' ? ' and through attorney of record' : ', pro se'}.\n\n`;

      if (divorceData.respondentAppeared) {
        text += `${divorceData.respondentName || 'Respondent'} appeared in person and announced ready.\n\n`;
      } else {
        text += `${divorceData.respondentName || 'Respondent'}, although duly cited, did not appear, and the Court proceeds to hear evidence and render judgment by default.\n\n`;
      }

      text += `A jury was waived. All matters in controversy were submitted to the Court.`;
    } else {
      text += `${divorceData.petitionerName || 'Petitioner'} appeared in person${divorceData.petitionerRepresentation === 'attorney' ? ' and through attorney of record' : ', pro se'}.\n\n`;
      text += `${divorceData.respondentName || 'Respondent'} ${divorceData.respondentAppeared ? 'appeared in person' : 'although duly cited, did not appear'}.\n\n`;
      text += `A jury was waived. All matters in controversy were submitted to the Court.`;
    }

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Texas jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION AND DOMICILE',
      text: `The Court finds that the pleadings of the parties are in due form and contain all the allegations, information, and prerequisites required by law. The Court finds that it has jurisdiction of this case and of all the parties and that at least sixty days have elapsed since the date the suit was filed. The Court further finds that, at the time this suit was filed, Petitioner had been a domiciliary of Texas for the preceding six-month period and a resident of ${divorceData.county || '[COUNTY]'} County for the preceding ninety-day period.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Texas dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DIVORCE GRANTED',
      text: `IT IS ORDERED AND DECREED that ${divorceData.petitionerName || 'Petitioner'} and ${divorceData.respondentName || 'Respondent'} are divorced and that the marriage between them is dissolved on the ground of insupportability.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Texas property division with community property language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court finds that the following is a just and right division of the parties\' community estate, having due regard for the rights of each party and any children of the marriage.',
      type: 'finding'
    });

    // Property to Petitioner
    items.push({
      content: `IT IS ORDERED AND DECREED that ${divorceData.petitionerName || 'Petitioner'} is awarded the following as ${divorceData.petitionerName || 'Petitioner'}'s sole and separate property, and ${divorceData.respondentName || 'Respondent'} is divested of all right, title, interest, and claim in and to that property:`,
      type: 'order'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    } else {
      items.push({
        content: '• All personal property in Petitioner\'s possession or subject to Petitioner\'s sole control',
        type: 'property_item'
      });
    }

    // Property to Respondent
    items.push({
      content: `IT IS ORDERED AND DECREED that ${divorceData.respondentName || 'Respondent'} is awarded the following as ${divorceData.respondentName || 'Respondent'}'s sole and separate property, and ${divorceData.petitionerName || 'Petitioner'} is divested of all right, title, interest, and claim in and to that property:`,
      type: 'order'
    });

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      divorceData.respondentProperty.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    } else {
      items.push({
        content: '• All personal property in Respondent\'s possession or subject to Respondent\'s sole control',
        type: 'property_item'
      });
    }

    return {
      title: 'DIVISION OF MARITAL ESTATE',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Texas child custody section with conservatorship language
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    // Children subject to order
    items.push({
      content: 'The Court finds that the following orders are in the best interest of the child(ren):',
      type: 'finding'
    });

    items.push({
      content: 'The child(ren) who are the subject of this suit are:',
      type: 'order'
    });

    divorceData.children.forEach((child, index) => {
      const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
      const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate) : null;
      items.push({
        content: birthDate ? `${index + 1}. ${childName}, born ${birthDate}` : `${index + 1}. ${childName}`,
        type: 'child_item'
      });
    });

    // Conservatorship appointment
    const custodyType = divorceData.custodyType || 'joint';

    if (custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED AND DECREED that ${divorceData.petitionerName || 'Petitioner'} and ${divorceData.respondentName || 'Respondent'} are appointed Joint Managing Conservators of the child(ren).`,
        type: 'order'
      });

      // Primary residence
      items.push({
        content: `IT IS ORDERED AND DECREED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have the exclusive right to designate the primary residence of the child(ren) within ${divorceData.residenceRestriction || divorceData.county || '[COUNTY]'} County, Texas, and contiguous counties.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED AND DECREED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} is appointed Sole Managing Conservator of the child(ren).`,
        type: 'order'
      });

      items.push({
        content: `IT IS ORDERED AND DECREED that ${divorceData.respondentName || 'Respondent'} is appointed Possessory Conservator of the child(ren).`,
        type: 'order'
      });
    }

    // Standard Possession Order
    items.push({
      content: 'IT IS ORDERED AND DECREED that the parties shall have possession of and access to the child(ren) in accordance with the Standard Possession Order as set forth in sections 153.311 through 153.317 of the Texas Family Code.',
      type: 'order'
    });

    return {
      title: 'CONSERVATORSHIP',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Texas visitation language (Standard Possession Order reference)
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that the parties shall have possession of and access to the child(ren) in accordance with the Standard Possession Order as set forth in sections 153.311 through 153.317 of the Texas Family Code.';
  }

  /**
   * Generate Texas child support section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child support section
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    const obligor = divorceData.childSupportObligor || divorceData.respondentName || 'Respondent';
    const obligee = divorceData.childSupportObligee || divorceData.petitionerName || 'Petitioner';

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED AND DECREED that ${obligor} is obligated to pay and shall pay to ${obligee} child support of $${divorceData.childSupportAmount} per month, with the first payment being due and payable on the 1st day of ${divorceData.childSupportStartMonth || '[MONTH]'}, ${divorceData.childSupportStartYear || '[YEAR]'}, and a like payment being due and payable on the 1st day of each month thereafter until the first month following the date of the earliest occurrence of one of the events described below.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED AND DECREED that ${obligor} shall pay child support in accordance with the Texas Family Code child support guidelines.`,
        type: 'order'
      });
    }

    // Withholding
    items.push({
      content: `IT IS ORDERED that income withholding for child support shall be implemented immediately, in accordance with section 158.001 et seq. of the Texas Family Code.`,
      type: 'order'
    });

    // Health insurance
    items.push({
      content: `IT IS ORDERED AND DECREED that ${divorceData.healthInsuranceProvider || obligor} shall maintain health insurance for the child(ren) as long as such insurance is available at a reasonable cost through the obligor's employer or membership in a union, trade association, or other organization.`,
      type: 'order'
    });

    // Dental insurance
    items.push({
      content: `IT IS ORDERED AND DECREED that ${divorceData.dentalInsuranceProvider || obligor} shall maintain dental insurance for the child(ren) as long as such insurance is available at a reasonable cost through the obligor's employer or membership in a union, trade association, or other organization.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Texas spousal support section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Spousal support section
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED AND DECREED that each party waives any right to spousal maintenance, now and in the future, from the other party.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner';

      items.push({
        content: `The Court finds that ${payee} lacks sufficient property to provide for ${payee}'s minimum reasonable needs and meets the eligibility requirements for spousal maintenance under Chapter 8 of the Texas Family Code.`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED AND DECREED that ${payor} shall pay spousal maintenance to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month, beginning on ${this.formatDate(divorceData.spousalSupportStartDate) || '[DATE]'} and continuing for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return {
      title: 'SPOUSAL MAINTENANCE',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Texas name change section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Name change section
   */
  generateNameChangeSection(divorceData) {
    if (!divorceData.requestNameChange || !divorceData.previousName) {
      return null;
    }

    const person = divorceData.nameChangeParty || divorceData.petitionerName || 'Petitioner';

    return {
      title: 'CHANGE OF NAME',
      text: `IT IS ORDERED AND DECREED that the name of ${person} is changed to ${divorceData.previousName}.`,
      type: 'name_change'
    };
  }

  /**
   * Generate Texas final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED AND DECREED that each party shall execute any and all instruments necessary to effectuate the provisions of this decree.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED AND DECREED that all relief requested in this case and not expressly granted in this decree is denied.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED AND DECREED that this decree is a final decree.',
      type: 'order'
    });

    // Costs
    items.push({
      content: 'IT IS ORDERED AND DECREED that costs of court are to be borne by the party who incurred them.',
      type: 'order'
    });

    return {
      title: 'MISCELLANEOUS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate Texas judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `SIGNED on _____________________, 20___.


_________________________________
JUDGE PRESIDING

${divorceData.judgeName ? divorceData.judgeName.toUpperCase() : ''}
${divorceData.courtNumber ? `${divorceData.courtNumber} JUDICIAL DISTRICT COURT` : ''}
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY, TEXAS` : ''}`,
      type: 'judgment'
    };
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
    if (!divorceData.county) {
      errors.push('County is required for Texas divorce decrees');
    }

    // Texas requires case/cause number for final decree
    if (!divorceData.caseNumber) {
      errors.push('Cause number is required for Texas final decree of divorce');
    }

    // Warning about children
    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    // Warning about child support
    if (divorceData.hasMinorChildren === true && !divorceData.childSupportAmount) {
      warnings.push('Child support amount not specified. The court will determine support per Texas Family Code guidelines.');
    }

    return { errors, warnings };
  }
}

module.exports = TexasDivorceDecreeTemplate;
