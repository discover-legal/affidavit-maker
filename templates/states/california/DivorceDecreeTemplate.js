// templates/states/california/DivorceDecreeTemplate.js
// California-specific Judgment of Dissolution of Marriage template
// Complies with California Family Code and California Rules of Court

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * California Judgment of Dissolution Template
 *
 * Legal References:
 * - California Family Code Division 6 (Nullity, Dissolution, and Legal Separation)
 * - Family Code § 2310 (Grounds for dissolution)
 * - Family Code § 2330-2334 (Procedure for dissolution)
 * - Family Code § 2550 (Community property division)
 * - Family Code § 4320 (Spousal support factors)
 * - California Code of Civil Procedure § 2015.5 (Declaration under penalty of perjury)
 * - California Rules of Court, Rule 5.12 (Format of family law papers)
 *
 * Formatting Requirements:
 * - 8.5" x 11" paper
 * - 1.5" left margin, 0.5" right margin
 * - 1" top margin, 0.5" bottom margin
 * - 12-point proportionally spaced font
 * - Double-spaced text
 *
 * California-Specific Terms:
 * - "Dissolution of Marriage" instead of "Divorce"
 * - "Judgment" instead of "Decree"
 * - "Case Number:" label
 * - "Spousal Support" instead of "Alimony"
 * - Community Property state (equal division presumption)
 * - 6-month waiting period from service
 * - Official form FL-180
 */
class CaliforniaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'CA';
    this.stateName = 'California';
    this.documentTitle = 'JUDGMENT OF DISSOLUTION OF MARRIAGE';

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
      'caseNumber',
      'marriageDate',
      'separationDate'
    ];

    // California formatting requirements (per Rules of Court)
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      marginLeft: '1.5in',
      marginRight: '0.5in',
      marginTop: '1in',
      marginBottom: '0.5in',
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
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `SUPERIOR COURT OF CALIFORNIA, COUNTY OF ${countyUpper}`;
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
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate California case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `${courtName.toUpperCase()}\n\n`;

    caption += `In re the Marriage of:\n\n`;

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    caption += `Petitioner: ${petitioner}\n\n`;

    caption += `and\n\n`;

    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    caption += `Respondent: ${respondent}`;

    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `\n\nCase Number: ${caseNumber}`;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate California title
   * @returns {string} Title text
   */
  generateTitle() {
    return 'JUDGMENT OF DISSOLUTION OF MARRIAGE\n[  ] Status Only  [  ] Reserving Jurisdiction  [  ] Judgment on Reserved Issues';
  }

  /**
   * Generate California appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This proceeding came on for hearing on ${this.formatDate(divorceData.hearingDate) || '___________________'} in Department ____.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Petitioner ${divorceData.petitionerName || '[PETITIONER NAME]'} appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'in pro per (self-represented)'}.\n\n`;

      if (divorceData.respondentAppeared) {
        text += `Respondent ${divorceData.respondentName || '[RESPONDENT NAME]'} appeared and submitted to the judgment.\n\n`;
      } else {
        text += `Respondent ${divorceData.respondentName || '[RESPONDENT NAME]'} having been properly served, did not appear, and default was entered.\n\n`;
      }
    } else {
      text += `Petitioner appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'in pro per'}.\n\n`;
      text += `Respondent ${divorceData.respondentAppeared ? 'appeared' : 'did not appear'}.`;
    }

    text += `\n\nThe Court, having reviewed the file and evidence, makes the following findings and orders:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate California jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    const waitingPeriodMet = divorceData.serviceDate
      ? `More than six months have elapsed since service of the Summons and Petition.`
      : `At least six months have elapsed since service of the Summons and Petition or the date Respondent filed a Response.`;

    return {
      title: 'JURISDICTION',
      text: `The Court finds:\n\n1. This Court has jurisdiction over this proceeding.\n\n2. The residency requirements of Family Code § 2320 have been met. Petitioner has been a resident of California for at least six months and of ${divorceData.county || '[COUNTY]'} County for at least three months immediately preceding the filing of this Petition.\n\n3. ${waitingPeriodMet}\n\n4. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'} and separated on ${this.formatDate(divorceData.separationDate) || '[DATE]'}.\n\n5. Irreconcilable differences have caused the irremediable breakdown of the marriage.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate California dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DISSOLUTION',
      text: `IT IS ORDERED that the marriage of Petitioner ${divorceData.petitionerName || '[PETITIONER NAME]'} and Respondent ${divorceData.respondentName || '[RESPONDENT NAME]'} is dissolved, and the parties are restored to the status of single persons, effective ${this.formatDate(divorceData.divorceDate) || 'the date this Judgment is entered'}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate California property division with community property language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court orders division of the community estate as follows (Family Code § 2550 - equal division):',
      type: 'finding'
    });

    // Property to Petitioner
    items.push({
      content: `The following community property is confirmed to Petitioner ${divorceData.petitionerName || '[PETITIONER NAME]'} as separate property:`,
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
      content: `The following community property is confirmed to Respondent ${divorceData.respondentName || '[RESPONDENT NAME]'} as separate property:`,
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

    // Separate property
    items.push({
      content: 'Each party\'s separate property is confirmed to that party.',
      type: 'order'
    });

    return {
      title: 'DIVISION OF PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate California child custody section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court makes the following orders regarding custody and visitation in the best interests of the minor child(ren):',
      type: 'finding'
    });

    items.push({
      content: 'The minor child(ren) of this marriage are:',
      type: 'order'
    });

    divorceData.children.forEach((child, index) => {
      const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
      const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) : null;
      items.push({
        content: birthDate ? `${index + 1}. ${childName}, born ${birthDate}` : `${index + 1}. ${childName}`,
        type: 'child_item'
      });
    });

    // Custody arrangement
    const custodyType = divorceData.custodyType || 'joint';

    if (custodyType === 'joint') {
      items.push({
        content: `Legal custody of the minor child(ren) is awarded to: [  ] Petitioner [  ] Respondent [X] Joint`,
        type: 'order'
      });

      items.push({
        content: `Physical custody of the minor child(ren) is awarded to: [X] ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} as primary parent [  ] Joint`,
        type: 'order'
      });
    } else {
      items.push({
        content: `Sole legal and physical custody is awarded to ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'}.`,
        type: 'order'
      });
    }

    // Visitation
    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'CHILD CUSTODY AND VISITATION',
      items,
      type: 'custody'
    };
  }

  /**
   * Get California visitation language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    return `Visitation shall be as set forth in the attached parenting plan, or if none, as follows: reasonable visitation upon reasonable notice.`;
  }

  /**
   * Generate California child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay guideline child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, payable on the 1st of each month, as calculated under the California Statewide Uniform Guideline (Family Code § 4050-4076).`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the California Statewide Uniform Guideline (Family Code § 4050-4076).`,
        type: 'order'
      });
    }

    // Income withholding
    items.push({
      content: 'An Earnings Assignment Order for Support is issued.',
      type: 'order'
    });

    // Health insurance
    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || obligor} shall maintain health insurance for the minor child(ren) through employer or other group plan if available at no cost or reasonable cost.`,
      type: 'order'
    });

    // Unreimbursed expenses
    items.push({
      content: 'Unreimbursed health care costs for the minor child(ren) shall be divided equally between the parties unless otherwise ordered.',
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate California spousal support section
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
        content: 'The Court terminates jurisdiction to award spousal support to either party.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner';

      items.push({
        content: `The Court, having considered the factors set forth in Family Code § 4320, orders as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay spousal support to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month, beginning ${this.formatDate(divorceData.spousalSupportStartDate) || '[DATE]'}.`,
        type: 'order'
      });

      // Duration
      const marriageLength = divorceData.marriageLengthYears || '[LENGTH]';
      if (marriageLength >= 10 || divorceData.longTermMarriage) {
        items.push({
          content: 'This is a marriage of long duration (10+ years). The Court retains jurisdiction over spousal support indefinitely.',
          type: 'order'
        });
      } else {
        items.push({
          content: `Spousal support shall continue for ${divorceData.spousalSupportDuration || 'one-half the length of the marriage'} unless modified or terminated.`,
          type: 'order'
        });
      }
    }

    return {
      title: 'SPOUSAL SUPPORT',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate California name change section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Name change section
   */
  generateNameChangeSection(divorceData) {
    if (!divorceData.requestNameChange || !divorceData.previousName) {
      return null;
    }

    const person = divorceData.nameChangeParty || divorceData.petitionerName || 'Petitioner';

    return {
      title: 'RESTORATION OF FORMER NAME',
      text: `IT IS ORDERED that ${person}'s former name is restored to: ${divorceData.previousName}.`,
      type: 'name_change'
    };
  }

  /**
   * Generate California final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'All other relief requested in this case is denied.',
      type: 'order'
    });

    items.push({
      content: 'This Judgment is final and binding on the parties.',
      type: 'order'
    });

    items.push({
      content: 'Each party shall execute any documents necessary to effectuate this Judgment.',
      type: 'order'
    });

    items.push({
      content: 'Unless otherwise ordered, each party shall bear their own attorney fees and costs.',
      type: 'order'
    });

    return {
      title: 'OTHER ORDERS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate California judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `Date: ___________________

_________________________________
JUDICIAL OFFICER

${divorceData.judgeName ? divorceData.judgeName.toUpperCase() : ''}
${divorceData.county ? `SUPERIOR COURT OF CALIFORNIA` : ''}
${divorceData.county ? `COUNTY OF ${divorceData.county.toUpperCase()}` : ''}`,
      type: 'judgment'
    };
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
      errors.push('County is required for California dissolution judgments');
    }

    // California requires case number for judgment
    if (!divorceData.caseNumber) {
      errors.push('Case number is required for California Judgment');
    }

    // California requires date of separation for community property division
    if (!divorceData.separationDate) {
      warnings.push('Date of separation is important for California community property division (Family Code § 70).');
    }

    // Warning about 6-month waiting period
    if (divorceData.serviceDate) {
      const serviceDate = new Date(divorceData.serviceDate);
      const today = new Date();
      const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;
      if (today - serviceDate < sixMonthsMs) {
        warnings.push('California requires a 6-month waiting period from service before judgment can be entered.');
      }
    } else {
      warnings.push('Ensure the 6-month waiting period from service has elapsed before entering judgment.');
    }

    // Warning about children
    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    return { errors, warnings };
  }
}

module.exports = CaliforniaDivorceDecreeTemplate;
