// templates/states/florida/DivorceDecreeTemplate.js
// Florida-specific Final Judgment of Dissolution of Marriage template
// Complies with Florida Statutes Chapter 61 and Florida Family Law Rules of Procedure

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

/**
 * Florida Final Judgment of Dissolution Template
 *
 * Legal References:
 * - Florida Statutes Chapter 61 (Dissolution of Marriage; Support; Time-Sharing)
 * - Florida Statutes § 61.052 (Dissolution of Marriage)
 * - Florida Statutes § 61.075 (Equitable distribution of marital assets and liabilities)
 * - Florida Statutes § 61.08 (Alimony)
 * - Florida Statutes § 61.13 (Parental responsibility and time-sharing)
 * - Florida Statutes § 61.30 (Child support guidelines)
 * - Florida Family Law Rules of Procedure
 * - Rule 12.285 (Mandatory disclosure)
 *
 * Formatting Requirements:
 * - 8.5" x 11" paper
 * - 1" margins on all sides
 * - 12-point Times New Roman or similar
 * - Double-spaced text
 * - Per Florida Family Law Rules of Procedure
 *
 * Florida-Specific Terms:
 * - "Dissolution of Marriage" instead of "Divorce"
 * - "Final Judgment" instead of "Decree"
 * - "Case No.:" label
 * - "Time-Sharing and Parental Responsibility" instead of "Custody"
 * - "Shared Parental Responsibility" for joint custody
 * - "Time-Sharing Schedule" instead of "Visitation"
 * - "Alimony" (bridge-the-gap, rehabilitative, durational, lump sum)
 * - Permanent alimony abolished effective July 1, 2023 (SB 1416)
 * - Equitable distribution state
 * - No mandatory waiting period
 */
class FloridaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'FL';
    this.stateName = 'Florida';
    this.documentTitle = 'FINAL JUDGMENT OF DISSOLUTION OF MARRIAGE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Florida-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'caseNumber',
      'marriageDate'
    ];

    // Florida formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * Get Florida case number label
   * @returns {string} "Case No.:"
   */
  getCaseNumberLabel() {
    return 'Case No.:';
  }

  /**
   * Get default court for Florida county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `CIRCUIT COURT OF THE _____ JUDICIAL CIRCUIT, IN AND FOR ${countyUpper} COUNTY, FLORIDA`;
  }

  /**
   * Generate Florida-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE CIRCUIT COURT OF THE STATE OF FLORIDA';
  }

  /**
   * Generate Florida-style venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `IN AND FOR ${countyUpper} COUNTY`;
  }

  /**
   * Generate Florida case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const countyUpper = (divorceData.county || '[COUNTY]').toUpperCase();
    caption += `IN THE CIRCUIT COURT OF THE ${divorceData.judicialCircuit || '________'} JUDICIAL CIRCUIT,\n`;
    caption += `IN AND FOR ${countyUpper} COUNTY, FLORIDA\n\n`;

    caption += `FAMILY LAW DIVISION\n\n`;

    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `Case No.: ${caseNumber}\n`;
    caption += `Division: ${divorceData.division || '________'}\n\n`;

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    caption += `${petitioner},\n`;
    caption += `Petitioner,\n\n`;

    caption += `and\n\n`;

    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    caption += `${respondent},\n`;
    caption += `Respondent.`;

    return {
      courtName: this.getDefaultCourt(divorceData.county),
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Florida appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `THIS CAUSE having come before this Court on ${this.formatDate(divorceData.hearingDate) || '___________________'} for final hearing,`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += ` and Petitioner, ${divorceData.petitionerName || '[PETITIONER NAME]'}, appearing ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se'},`;

      if (divorceData.respondentAppeared) {
        text += ` and Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, appearing and consenting to the entry of this Final Judgment,`;
      } else {
        text += ` and Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, having been served and not appearing,`;
      }
    } else {
      text += ` and Petitioner appearing ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se'},`;
      text += ` and Respondent ${divorceData.respondentAppeared ? 'appearing' : 'not appearing after proper service'},`;
    }

    text += ` and the Court having reviewed the file and heard testimony, and being otherwise fully advised in the premises, it is hereby:`;

    return {
      title: '',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Florida jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'FINDINGS',
      text: `ORDERED AND ADJUDGED as follows:\n\n1. The Court has jurisdiction over the subject matter and the parties.\n\n2. ${divorceData.residencyProvingParty || 'Petitioner'} has been a resident of the State of Florida for at least six (6) months prior to the filing of the Petition, as required by Florida Statutes § 61.021.\n\n3. The marriage between the parties is irretrievably broken.\n\n4. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'} and separated on or about ${this.formatDate(divorceData.separationDate) || '[DATE]'}.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Florida dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DISSOLUTION',
      text: `The marriage between ${divorceData.petitionerName || 'Petitioner'} and ${divorceData.respondentName || 'Respondent'} is hereby dissolved, and the parties are restored to the status of being single.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Florida property division with equitable distribution language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'Pursuant to Florida Statutes § 61.075, the Court makes an equitable distribution of the marital assets and liabilities as follows:',
      type: 'finding'
    });

    // Property to Petitioner (called Husband/Wife in Florida forms typically)
    items.push({
      content: `The following marital assets and liabilities are distributed to ${divorceData.petitionerName || 'Petitioner'} as that party's sole property:`,
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
      content: `The following marital assets and liabilities are distributed to ${divorceData.respondentName || 'Respondent'} as that party's sole property:`,
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
      title: 'EQUITABLE DISTRIBUTION OF MARITAL ASSETS AND LIABILITIES',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Florida parental responsibility and time-sharing section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following Parenting Plan and Time-Sharing Schedule is in the best interests of the minor child(ren):',
      type: 'finding'
    });

    items.push({
      content: 'The minor child(ren) of the marriage are:',
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

    // Parental Responsibility (Florida term)
    // Safety rule (mirrors the base class): only positively recognized
    // custody values render a joint or sole order. Legacy free text like
    // "joint decision making" maps to the joint branch; anything ambiguous
    // renders neutral as-agreed language with a placeholder — NEVER a sole
    // order (see templates/core/parenting.js).
    const custody = resolveCustodyArrangement(divorceData);
    const residenceName = resolvePrimaryResidenceName(divorceData);
    let soleCustodianName = null;

    if (custody.kind === 'joint') {
      items.push({
        content: `The parties shall have Shared Parental Responsibility for the minor child(ren).`,
        type: 'order'
      });

      items.push({
        content: `${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have majority time-sharing with the minor child(ren).`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'Petitioner')
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || 'Respondent')
            : (divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner');
      soleCustodianName = custodianName;
      items.push({
        content: `${custodianName} shall have Sole Parental Responsibility for the minor child(ren).`,
        type: 'order'
      });
    } else {
      // Unrecognized/undecided arrangement — neutral order with an explicit
      // placeholder for the parties' actual agreement. Never default to sole.
      items.push({
        content: 'IT IS ORDERED that the parties shall exercise legal custody and decision-making responsibility for the minor child(ren) as agreed by the parties: [ARRANGEMENT — set out the parties\' decision-making agreement].',
        type: 'order'
      });
    }

    // Primary residence: ordered whenever the case data says where the
    // child(ren) live, regardless of the custody branch. (The joint branch
    // keeps its historical wording and fallbacks unchanged.)
    if (custody.kind !== 'joint' && residenceName && residenceName !== soleCustodianName) {
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}.`,
        type: 'order'
      });
    }

    // Time-Sharing (Florida term for visitation)
    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'PARENTAL RESPONSIBILITY AND TIME-SHARING',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Florida time-sharing language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Time-sharing language
   */
  getVisitationLanguage(divorceData) {
    return `The parties shall follow the Time-Sharing Schedule set forth in the Parenting Plan filed with the Court and incorporated herein by reference, or if no Parenting Plan, reasonable time-sharing upon reasonable notice.`;
  }

  /**
   * Generate Florida child support section
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
        content: `${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Florida Child Support Guidelines, Florida Statutes § 61.30.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `Child support shall be calculated and paid in accordance with the Florida Child Support Guidelines, Florida Statutes § 61.30.`,
        type: 'order'
      });
    }

    // Income deduction
    items.push({
      content: 'An Income Deduction Order is issued for the collection of child support.',
      type: 'order'
    });

    // Health insurance
    items.push({
      content: `${divorceData.healthInsuranceProvider || obligor} shall provide health insurance for the minor child(ren) if available at reasonable cost through an employer or other group plan.`,
      type: 'order'
    });

    // Non-covered medical expenses
    items.push({
      content: 'Non-covered medical, dental, and vision expenses for the minor child(ren) shall be paid by the parties in proportion to their respective incomes.',
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Florida alimony section
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
        content: 'Each party waives any claim to alimony from the other, now and in the future. The Court terminates jurisdiction to award alimony to either party.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner';
      // Permanent alimony is abolished in Florida effective July 1, 2023 (SB 1416; § 61.08).
      // Reject any attempt to award permanent alimony and fall back to durational.
      const requestedType = divorceData.alimonyType || 'durational';
      const prohibitedTypes = ['permanent'];
      const alimonyType = prohibitedTypes.includes(requestedType) ? 'durational' : requestedType;

      items.push({
        content: `The Court, having considered the factors set forth in Florida Statutes § 61.08, awards ${alimonyType} alimony as follows:`,
        type: 'finding'
      });

      items.push({
        content: `${payor} shall pay ${alimonyType} alimony to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month, beginning ${this.formatDate(divorceData.spousalSupportStartDate) || '[DATE]'} and continuing for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });

      // Florida-specific: Income Deduction Order for alimony
      items.push({
        content: 'An Income Deduction Order is issued for the collection of alimony.',
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
   * Generate Florida name change section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Name change section
   */
  generateNameChangeSection(divorceData) {
    if (!divorceData.requestNameChange || !divorceData.previousName) {
      return null;
    }

    const person = divorceData.nameChangeParty || divorceData.petitionerName || 'Petitioner';

    return {
      title: 'NAME CHANGE',
      text: `The former name of ${person} is restored to: ${divorceData.previousName}.`,
      type: 'name_change'
    };
  }

  /**
   * Generate Florida final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'Each party shall execute and deliver any documents necessary to carry out the terms of this Final Judgment.',
      type: 'order'
    });

    items.push({
      content: 'All relief not specifically granted herein is denied.',
      type: 'order'
    });

    items.push({
      content: 'The Court reserves jurisdiction to enforce and modify the terms of this Final Judgment.',
      type: 'order'
    });

    items.push({
      content: 'Each party shall bear their own attorney fees and costs unless otherwise ordered.',
      type: 'order'
    });

    return {
      title: 'GENERAL PROVISIONS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate Florida judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `DONE AND ORDERED in ${divorceData.county || '[COUNTY]'} County, Florida, this _____ day of _______________, 20___.


_________________________________
CIRCUIT COURT JUDGE

${divorceData.judgeName ? divorceData.judgeName.toUpperCase() : ''}

Copies furnished to:
Petitioner: ${divorceData.petitionerName || '________'}
Respondent: ${divorceData.respondentName || '________'}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Florida-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // Florida requires county
    if (!divorceData.county) {
      errors.push('County is required for Florida dissolution judgments');
    }

    // Florida requires case number for final judgment
    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Florida Final Judgment');
    }

    // Warning about residency proof
    warnings.push('Florida requires proof of residency (6 months), typically through corroborating witness or documentation.');

    // Warning about children
    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    // Warning about parenting plan
    if (divorceData.hasMinorChildren === true) {
      warnings.push('Florida requires a Parenting Plan when minor children are involved (Florida Statutes § 61.13).');
    }

    // Permanent alimony is abolished effective July 1, 2023 (SB 1416; § 61.08).
    if (divorceData.alimonyType === 'permanent') {
      errors.push('Permanent alimony is prohibited in Florida effective July 1, 2023 (SB 1416; Fla. Stat. § 61.08). The alimony type has been changed to durational.');
    }

    return { errors, warnings };
  }
}

module.exports = FloridaDivorceDecreeTemplate;
