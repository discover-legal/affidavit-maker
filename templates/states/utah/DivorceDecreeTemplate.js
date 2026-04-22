// templates/states/utah/DivorceDecreeTemplate.js
// Utah-specific decree of divorce template
// Complies with Utah Code Title 81, Chapter 4 (formerly Title 30, Chapter 3) and Utah Rules of Civil Procedure

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Utah Decree of Divorce Template
 *
 * Legal References:
 * - Utah Code Title 81, Chapter 4 (Dissolution of Marriage) — recodified 9/1/2024; formerly Title 30, Chapter 3
 * - Utah Code § 81-4-402 (Petition for divorce; residency; 30-day waiting period)
 * - Utah Code § 81-4-405 (Grounds for divorce)
 * - Utah Code § 81-4-406 (Decree of divorce — property, maintenance, custody)
 * - Utah Code Title 81, Chapter 6 (Child Support; formerly § 78B-12)
 *
 * Formatting Requirements:
 * - 8.5" x 11" paper
 * - 1" margins on all sides
 * - 12-point font minimum
 * - Double-spaced text
 * - Per Utah Rules of Civil Procedure Rule 10
 *
 * Utah-Specific Terms:
 * - "Case No." for case number
 * - "Custody" (not "Conservatorship")
 * - "Joint Legal Custody" / "Sole Custody"
 * - "Parent-time" instead of "Visitation"
 * - "Alimony" for spousal support
 * - 30-day waiting period from filing (Utah Code § 81-4-402); court may waive for extraordinary circumstances
 */
class UtahDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'UT';
    this.stateName = 'Utah';
    this.documentTitle = 'DECREE OF DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Utah-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'caseNumber',
      'marriageDate'
    ];

    // Utah formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * Get Utah case number label
   * @returns {string} "Case No."
   */
  getCaseNumberLabel() {
    return 'Case No.';
  }

  /**
   * Get default court for Utah county
   * Different counties fall under different judicial districts (1st through 8th).
   * The generic caption format used by Utah courts is:
   * "IN THE DISTRICT COURT OF THE STATE OF UTAH / IN AND FOR [COUNTY] COUNTY"
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `DISTRICT COURT OF THE STATE OF UTAH, IN AND FOR ${countyUpper} COUNTY`;
  }

  /**
   * Generate Utah-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE DISTRICT COURT OF THE STATE OF UTAH';
  }

  /**
   * Generate Utah-style venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `${countyUpper} COUNTY`;
  }

  /**
   * Generate Utah case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const countyUpper = (divorceData.county || '[COUNTY]').toUpperCase();
    caption += `IN THE DISTRICT COURT OF THE STATE OF UTAH\n`;
    caption += `IN AND FOR ${countyUpper} COUNTY\n\n`;

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    caption += `${petitioner},\n`;
    caption += `Petitioner,\n\n`;

    caption += `vs.\n\n`;

    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    caption += `${respondent},\n`;
    caption += `Respondent.`;

    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `\n\nCase No. ${caseNumber}`;
    caption += `\nJudge: ${divorceData.judgeName || '________________'}`;

    return {
      courtName: this.getDefaultCourt(divorceData.county),
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Utah appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `The above-entitled matter came on for hearing on ${this.formatDate(divorceData.hearingDate) || '___________________'}.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `${divorceData.petitionerName || 'Petitioner'} appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'by and through counsel' : 'pro se'}.\n\n`;

      if (divorceData.respondentAppeared) {
        text += `${divorceData.respondentName || 'Respondent'} appeared and stipulated to the entry of this Decree.\n\n`;
      } else {
        text += `${divorceData.respondentName || 'Respondent'} did not appear but has signed a Stipulation and has waived any further notice.\n\n`;
      }
    } else {
      text += `${divorceData.petitionerName || 'Petitioner'} appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'by and through counsel' : 'pro se'}.\n\n`;
      text += `${divorceData.respondentName || 'Respondent'} ${divorceData.respondentAppeared ? 'appeared' : 'did not appear, having been properly served, and default was entered'}.`;
    }

    text += `\n\nThe Court, having reviewed the pleadings and evidence, and being fully advised in the premises, hereby enters the following:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Utah jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'FINDINGS OF FACT AND CONCLUSIONS OF LAW',
      text: `1. The Court has jurisdiction over this matter and the parties.\n\n2. Petitioner has been an actual and bona fide resident of ${divorceData.county || '[COUNTY]'} County, Utah, for at least ninety (90) days immediately prior to the filing of this action, satisfying the requirements of Utah Code § 81-4-402.\n\n3. At least thirty (30) days have elapsed since the date the petition was filed, satisfying the waiting period requirements of Utah Code § 81-4-402.\n\n4. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'} and have irreconcilable differences which have caused the irremediable breakdown of the marriage.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Utah dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DECREE OF DIVORCE',
      text: `IT IS HEREBY ORDERED, ADJUDGED AND DECREED that ${divorceData.petitionerName || 'Petitioner'} and ${divorceData.respondentName || 'Respondent'} are hereby divorced, and the bonds of matrimony heretofore existing between them are dissolved on the grounds of irreconcilable differences.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Utah property division section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court finds that the following is a fair and equitable division of the parties\' marital property:',
      type: 'finding'
    });

    // Property to Petitioner
    items.push({
      content: `IT IS ORDERED that ${divorceData.petitionerName || 'Petitioner'} is awarded the following property as ${divorceData.petitionerName || 'Petitioner'}'s sole and separate property:`,
      type: 'order'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    } else {
      items.push({
        content: '• All personal property currently in Petitioner\'s possession',
        type: 'property_item'
      });
    }

    // Property to Respondent
    items.push({
      content: `IT IS ORDERED that ${divorceData.respondentName || 'Respondent'} is awarded the following property as ${divorceData.respondentName || 'Respondent'}'s sole and separate property:`,
      type: 'order'
    });

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      divorceData.respondentProperty.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    } else {
      items.push({
        content: '• All personal property currently in Respondent\'s possession',
        type: 'property_item'
      });
    }

    return {
      title: 'DIVISION OF MARITAL PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Utah child custody section with Utah terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody and parent-time orders are in the best interests of the minor child(ren):',
      type: 'finding'
    });

    items.push({
      content: 'The minor child(ren) of the marriage are:',
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

    // Custody arrangement
    const custodyType = divorceData.custodyType || 'joint';

    if (custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'Petitioner'} and ${divorceData.respondentName || 'Respondent'} are awarded joint legal custody of the minor child(ren).`,
        type: 'order'
      });

      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} is awarded primary physical custody of the minor child(ren).`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} is awarded sole legal and physical custody of the minor child(ren).`,
        type: 'order'
      });
    }

    // Parent-time (Utah term for visitation)
    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'CUSTODY AND PARENT-TIME',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Utah parent-time language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parent-time language
   */
  getVisitationLanguage(divorceData) {
    const nonCustodial = divorceData.primaryCustodian === divorceData.petitionerName
      ? divorceData.respondentName
      : divorceData.petitionerName;

    return `IT IS ORDERED that ${nonCustodial || 'the non-custodial parent'} shall have parent-time with the minor child(ren) in accordance with Utah Code § 81-9-302 (minimum schedule) or as otherwise agreed by the parties.`;
  }

  /**
   * Generate Utah child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Utah Child Support Guidelines, Utah Code Title 81, Chapter 6`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be calculated and paid in accordance with the Utah Child Support Guidelines, Utah Code Title 81, Chapter 6`,
        type: 'order'
      });
    }

    // Income withholding
    items.push({
      content: 'IT IS ORDERED that child support payments shall be made through the Office of Recovery Services by immediate income withholding unless otherwise agreed.',
      type: 'order'
    });

    // Health insurance
    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || obligor} shall maintain health insurance for the minor child(ren) if insurance is available at a reasonable cost through an employer or other group plan.`,
      type: 'order'
    });

    // Medical expenses
    items.push({
      content: 'IT IS ORDERED that the parties shall each pay one-half of all reasonable and necessary uninsured medical, dental, and vision expenses for the minor child(ren).',
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Utah alimony section (Utah uses "Alimony" not "Spousal Maintenance")
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Alimony section
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party waives any claim to alimony from the other party, now and in the future.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner';

      items.push({
        content: `The Court, having considered the factors set forth in Utah Code § 81-4-504, including the financial conditions and needs of the parties, their earning capacities, and the length of the marriage, finds that alimony is appropriate.`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay alimony to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month, beginning ${this.formatDate(divorceData.spousalSupportStartDate) || '[DATE]'} and continuing for ${divorceData.spousalSupportDuration || '[DURATION]'} or until the occurrence of a terminating event under Utah law.`,
        type: 'order'
      });
    }

    return {
      title: 'ALIMONY',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Utah name change section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Name change section
   */
  generateNameChangeSection(divorceData) {
    if (!divorceData.requestNameChange || !divorceData.previousName) {
      return null;
    }

    const person = divorceData.nameChangeParty || divorceData.petitionerName || 'Petitioner';

    return {
      title: 'RESTORATION OF NAME',
      text: `IT IS ORDERED that the name of ${person} is restored to ${divorceData.previousName}.`,
      type: 'name_change'
    };
  }

  /**
   * Generate Utah final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that each party shall execute any and all documents necessary to effectuate the terms of this Decree.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that all relief requested in this case and not expressly granted in this Decree is denied.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that this Decree shall become final upon entry by the Court.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall bear their own costs and attorney fees incurred in this action.',
      type: 'order'
    });

    return {
      title: 'MISCELLANEOUS PROVISIONS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate Utah judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `DATED this _____ day of _______________, 20___.

BY THE COURT:


_________________________________
District Court Judge

${divorceData.judgeName ? divorceData.judgeName.toUpperCase() : ''}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Utah-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // Utah requires county
    if (!divorceData.county) {
      errors.push('County is required for Utah divorce decrees');
    }

    // Utah requires case number for decree
    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Utah Decree of Divorce');
    }

    // Warning about children
    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    // Warning about divorce education class
    if (divorceData.hasMinorChildren === true) {
      warnings.push('Utah requires both parents to complete a divorce education class when minor children are involved (Utah Code § 81-4-409).');
    }

    return { errors, warnings };
  }
}

module.exports = UtahDivorceDecreeTemplate;
