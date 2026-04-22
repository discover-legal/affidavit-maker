// templates/states/illinois/DivorceDecreeTemplate.js
// Illinois-specific Judgment of Dissolution of Marriage template
// Complies with 750 ILCS 5 (Illinois Marriage and Dissolution of Marriage Act)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Illinois Judgment of Dissolution Template
 *
 * Legal References:
 * - 750 ILCS 5 (Illinois Marriage and Dissolution of Marriage Act)
 * - 750 ILCS 5/401 (Dissolution of Marriage)
 * - 750 ILCS 5/503 (Division of marital property)
 * - 750 ILCS 5/504 (Maintenance - spousal support)
 * - 750 ILCS 5/505 (Child support)
 * - 750 ILCS 5/602.5-602.7 (Allocation of Parental Responsibilities)
 * - 750 ILCS 5/501(a)(1) (Financial Affidavit requirement)
 * - 750 ILCS 5/707 (Certificate of Dissolution requirement)
 *
 * Formatting Requirements:
 * - 8.5" x 11" paper
 * - 1" margins on all sides
 * - 12-point Times New Roman or similar
 * - Double-spaced text
 * - Must use Statewide Approved Standardized Forms
 *
 * Illinois-Specific Terms:
 * - "Dissolution of Marriage" instead of "Divorce"
 * - "Judgment of Dissolution" instead of "Decree"
 * - "Case No." label
 * - "Allocation of Parental Responsibilities" instead of "Custody"
 * - "Parenting Time" instead of "Visitation"
 * - "Maintenance" instead of "Alimony" (statutory formula)
 * - Equitable distribution state
 * - Only no-fault ground available (since January 1, 2016)
 */
class IllinoisDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'IL';
    this.stateName = 'Illinois';
    this.documentTitle = 'JUDGMENT OF DISSOLUTION OF MARRIAGE';

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
      'caseNumber',
      'marriageDate'
    ];

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
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `CIRCUIT COURT OF ${countyUpper} COUNTY, ILLINOIS`;
  }

  /**
   * Generate Illinois-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE CIRCUIT COURT OF ILLINOIS';
  }

  /**
   * Generate Illinois-style venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `${countyUpper} COUNTY`;
  }

  /**
   * Generate Illinois case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const countyUpper = (divorceData.county || '[COUNTY]').toUpperCase();
    caption += `IN THE CIRCUIT COURT OF THE ${divorceData.judicialCircuit || '_____'} JUDICIAL CIRCUIT\n`;
    caption += `${countyUpper} COUNTY, ILLINOIS\n\n`;

    caption += `In re the Marriage of:\n\n`;

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    caption += `${petitioner},\n`;
    caption += `Petitioner,\n\n`;

    caption += `and\n\n`;

    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    caption += `${respondent},\n`;
    caption += `Respondent.`;

    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `\n\nCase No. ${caseNumber}`;

    return {
      courtName: this.getDefaultCourt(divorceData.county),
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Illinois appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This cause coming on for hearing on ${this.formatDate(divorceData.hearingDate) || '___________________'},`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += ` Petitioner, ${divorceData.petitionerName || '[PETITIONER NAME]'}, appearing ${divorceData.petitionerRepresentation === 'attorney' ? 'by and through counsel' : 'pro se'},`;

      if (divorceData.respondentAppeared) {
        text += ` and Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, appearing and agreeing to the entry of this Judgment,`;
      } else {
        text += ` and Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, having been served and defaulting,`;
      }
    } else {
      text += ` Petitioner appearing ${divorceData.petitionerRepresentation === 'attorney' ? 'by counsel' : 'pro se'},`;
      text += ` and Respondent ${divorceData.respondentAppeared ? 'appearing' : 'not appearing'},`;
    }

    text += ` and the Court having examined the evidence, heard testimony, reviewed the file, and being fully advised in the premises;`;

    text += `\n\nTHE COURT FINDS:`;

    return {
      title: '',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Illinois jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'FINDINGS OF FACT',
      text: `1. The Court has jurisdiction over this matter and the parties.\n\n2. At least one of the parties has been a resident of the State of Illinois for ninety (90) days immediately preceding the entry of this Judgment, satisfying the requirements of 750 ILCS 5/401.\n\n3. Irreconcilable differences have caused the irretrievable breakdown of the marriage, and efforts at reconciliation have failed or future attempts at reconciliation would be impracticable and not in the best interests of the family. (750 ILCS 5/401(a)(2))\n\n4. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'} and have been living separate and apart since ${this.formatDate(divorceData.separationDate) || '[DATE]'}.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Illinois dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'JUDGMENT',
      text: `IT IS HEREBY ORDERED, ADJUDGED, AND DECREED that the marriage between ${divorceData.petitionerName || 'Petitioner'} and ${divorceData.respondentName || 'Respondent'} is dissolved, and the parties are restored to the status of unmarried persons.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Illinois property division with equitable distribution language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'Pursuant to 750 ILCS 5/503, the Court divides the marital property in just proportions as follows:',
      type: 'finding'
    });

    // Property to Petitioner
    items.push({
      content: `The following marital property is assigned to ${divorceData.petitionerName || 'Petitioner'} as that party's sole and separate property:`,
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
      content: `The following marital property is assigned to ${divorceData.respondentName || 'Respondent'} as that party's sole and separate property:`,
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

    // Non-marital property
    items.push({
      content: 'Each party\'s non-marital property is confirmed to that party.',
      type: 'order'
    });

    return {
      title: 'DIVISION OF MARITAL PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Illinois allocation of parental responsibilities section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following Allocation of Parental Responsibilities and Parenting Time is in the best interests of the minor child(ren) pursuant to 750 ILCS 5/602.5 - 602.7:',
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

    // Allocation of Parental Responsibilities (Illinois term)
    const custodyType = divorceData.custodyType || 'joint';

    if (custodyType === 'joint') {
      items.push({
        content: `The parties shall have Joint Allocation of Significant Decision-Making Responsibilities regarding the minor child(ren) for:\n  - Education\n  - Health\n  - Religion\n  - Extracurricular activities`,
        type: 'order'
      });

      items.push({
        content: `${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have the majority of Parenting Time with the minor child(ren).`,
        type: 'order'
      });
    } else {
      items.push({
        content: `${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have Sole Allocation of Significant Decision-Making Responsibilities regarding the minor child(ren).`,
        type: 'order'
      });
    }

    // Parenting Time (Illinois term)
    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    // Parenting Plan requirement
    items.push({
      content: 'The parties shall follow the Parenting Plan filed with the Court and incorporated herein by reference.',
      type: 'order'
    });

    return {
      title: 'ALLOCATION OF PARENTAL RESPONSIBILITIES AND PARENTING TIME',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Illinois parenting time language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    const nonCustodial = divorceData.primaryCustodian === divorceData.petitionerName
      ? divorceData.respondentName
      : divorceData.petitionerName;

    return `${nonCustodial || 'The non-majority parenting time parent'} shall have Parenting Time with the minor child(ren) as set forth in the Parenting Plan.`;
  }

  /**
   * Generate Illinois child support section
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
        content: `${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Illinois Child Support Guidelines, 750 ILCS 5/505.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `Child support shall be calculated and paid in accordance with the Illinois Child Support Guidelines (income shares model), 750 ILCS 5/505.`,
        type: 'order'
      });
    }

    // Income withholding
    items.push({
      content: 'An Order for Withholding is entered for the collection of child support through the State Disbursement Unit.',
      type: 'order'
    });

    // Health insurance
    items.push({
      content: `${divorceData.healthInsuranceProvider || obligor} shall maintain health insurance for the minor child(ren) if available at reasonable cost through an employer or other group plan.`,
      type: 'order'
    });

    // Unreimbursed medical expenses
    items.push({
      content: 'The parties shall divide unreimbursed medical, dental, optical, and pharmaceutical expenses for the minor child(ren) in proportion to their respective net incomes.',
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Illinois maintenance section (uses statutory formula)
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Maintenance section
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'Each party waives any claim to maintenance from the other. This waiver is non-modifiable.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner';

      items.push({
        content: `The Court, having applied the statutory formula set forth in 750 ILCS 5/504(b-1)(1) — [(33-1/3% of payor's net income) minus (25% of payee's net income)] — orders maintenance as follows:`,
        type: 'finding'
      });

      items.push({
        content: `${payor} shall pay maintenance to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month, beginning ${this.formatDate(divorceData.spousalSupportStartDate) || '[DATE]'}.`,
        type: 'order'
      });

      // Illinois formula duration
      const marriageYears = divorceData.marriageLengthYears || '[YEARS]';
      if (marriageYears >= 20 || divorceData.indefiniteMaintenance) {
        items.push({
          content: 'Based on the duration of the marriage (20+ years), maintenance is ordered for a period equal to the length of the marriage or indefinitely.',
          type: 'order'
        });
      } else {
        items.push({
          content: `Maintenance shall continue for ${divorceData.spousalSupportDuration || 'a period calculated under the statutory formula'}.`,
          type: 'order'
        });
      }

      // Reviewability
      if (!divorceData.nonModifiable) {
        items.push({
          content: 'This maintenance award is reviewable and modifiable upon a showing of substantial change of circumstances.',
          type: 'order'
        });
      }
    }

    return {
      title: 'MAINTENANCE',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Illinois name change section
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
      text: `The former name of ${person} is restored to: ${divorceData.previousName}.`,
      type: 'name_change'
    };
  }

  /**
   * Generate Illinois final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'Each party shall execute and deliver any documents necessary to effectuate this Judgment.',
      type: 'order'
    });

    items.push({
      content: 'All relief not specifically granted herein is denied.',
      type: 'order'
    });

    items.push({
      content: 'This Court retains jurisdiction to enforce and modify the provisions of this Judgment.',
      type: 'order'
    });

    items.push({
      content: 'Each party shall bear their own attorney fees and costs unless otherwise ordered.',
      type: 'order'
    });

    // Certificate of Dissolution requirement
    items.push({
      content: 'A Certificate of Dissolution shall be prepared and filed with the Illinois Department of Public Health pursuant to 750 ILCS 5/707.',
      type: 'order'
    });

    return {
      title: 'MISCELLANEOUS PROVISIONS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate Illinois judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `ENTERED this _____ day of _______________, 20___.


_________________________________
CIRCUIT COURT JUDGE

${divorceData.judgeName ? divorceData.judgeName.toUpperCase() : ''}
${divorceData.county ? `CIRCUIT COURT OF ${divorceData.county.toUpperCase()} COUNTY, ILLINOIS` : ''}`,
      type: 'judgment'
    };
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
      errors.push('County is required for Illinois dissolution judgments');
    }

    // Illinois requires case number for judgment
    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Illinois Judgment of Dissolution');
    }

    // Warning about residency
    warnings.push('Ensure 90-day Illinois residency requirement is met before entry of judgment.');

    // Warning about financial affidavit
    warnings.push('Illinois requires Financial Affidavits from both parties (750 ILCS 5/501(a)(1)).');

    // Warning about children
    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    // Warning about parenting plan
    if (divorceData.hasMinorChildren === true) {
      warnings.push('Illinois requires a Parenting Plan when minor children are involved.');
    }

    return { errors, warnings };
  }
}

module.exports = IllinoisDivorceDecreeTemplate;
