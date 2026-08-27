// templates/states/arizona/DivorceDecreeTemplate.js
// Arizona-specific Decree of Dissolution of Marriage template
// Complies with Arizona Revised Statutes Title 25 and Arizona Rules of Family Law Procedure

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName, resolveNonResidentialParentName } = require('../../core/parenting');
const { asList } = require('../../core/dataShapes');

/**
 * Arizona Decree of Dissolution Template
 *
 * Legal References:
 * - A.R.S. Title 25 (Marital and Domestic Relations)
 * - A.R.S. § 25-311 through 25-319 (Dissolution of Marriage)
 * - A.R.S. § 25-312 (Grounds - irretrievably broken)
 * - A.R.S. § 25-315 (Preliminary injunction requirements)
 * - A.R.S. § 25-318 (Community property division)
 * - A.R.S. § 25-319 (Spousal maintenance)
 * - A.R.S. § 25-401 through 25-414 (Legal Decision-Making and Parenting Time)
 * - A.R.S. § 25-351 (Parent Information Program)
 *
 * Formatting Requirements:
 * - 8.5" x 11" paper
 * - 2" top margin (first page), 1.5" subsequent
 * - 1" left margin, 0.5" right margin
 * - 14-point font minimum (13pt for footnotes)
 * - Double-spaced text
 * - Per Arizona Superior Court Administrative Order
 *
 * Arizona-Specific Terms:
 * - "Dissolution of Marriage" instead of "Divorce"
 * - "Case No." label
 * - "Legal Decision-Making" instead of "Custody"
 * - "Parenting Time" instead of "Visitation"
 * - "Spousal Maintenance" instead of "Alimony"
 * - Community Property state (equal division — A.R.S. § 25-318)
 * - 60-day waiting period from service
 */
class ArizonaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'AZ';
    this.stateName = 'Arizona';
    this.documentTitle = 'DECREE OF DISSOLUTION OF MARRIAGE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Arizona-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'caseNumber',
      'marriageDate'
    ];

    // Arizona formatting requirements
    this.formatting = {
      fontSize: '14pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      marginTop: '2in',
      marginTopSubsequent: '1.5in',
      marginLeft: '1in',
      marginRight: '0.5in',
      marginBottom: '0.5in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * Get Arizona case number label
   * @returns {string} "Case No."
   */
  getCaseNumberLabel() {
    return 'Case No.';
  }

  /**
   * Get default court for Arizona county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `SUPERIOR COURT OF ARIZONA IN AND FOR ${countyUpper} COUNTY`;
  }

  /**
   * Generate Arizona-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE SUPERIOR COURT OF THE STATE OF ARIZONA';
  }

  /**
   * Generate Arizona-style venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `IN AND FOR THE COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate Arizona case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    caption += `IN THE SUPERIOR COURT OF THE STATE OF ARIZONA\n`;
    caption += `IN AND FOR THE COUNTY OF ${(divorceData.county || '[COUNTY]').toUpperCase()}\n\n`;

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

    if (divorceData.hasMinorChildren) {
      caption += `\n\n(With Minor Children)`;
    }

    return {
      courtName: this.getDefaultCourt(divorceData.county),
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Arizona appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This matter came before the Court on ${this.formatDate(divorceData.hearingDate) || '___________________'}.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Petitioner, ${divorceData.petitionerName || '[PETITIONER NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'through counsel' : 'self-represented'}.\n\n`;

      if (divorceData.respondentAppeared) {
        text += `Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, appeared and consented to the entry of this Decree.\n\n`;
      } else {
        text += `Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, having been properly served, did not appear. Default was entered.\n\n`;
      }
    } else {
      text += `Petitioner appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'through counsel' : 'self-represented'}.\n\n`;
      text += `Respondent ${divorceData.respondentAppeared ? 'appeared' : 'did not appear after proper service'}.\n\n`;
    }

    text += `The Court, having considered the pleadings, evidence, and applicable law, enters the following Findings of Fact, Conclusions of Law, and Decree:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Arizona jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'FINDINGS OF FACT AND CONCLUSIONS OF LAW',
      text: `1. The Court has jurisdiction over this matter and the parties pursuant to A.R.S. § 25-312.\n\n2. At least one party has been domiciled in Arizona for ninety (90) days prior to filing, as required by A.R.S. § 25-312.\n\n3. At least sixty (60) days have elapsed since service of the Petition and Summons, as required by A.R.S. § 25-329.\n\n4. A Preliminary Injunction was issued and served in accordance with A.R.S. § 25-315(A).\n\n5. The marriage between the parties is irretrievably broken with no reasonable prospect of reconciliation.\n\n6. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Arizona dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DECREE',
      text: `IT IS ORDERED that the marriage between ${divorceData.petitionerName || 'Petitioner'} and ${divorceData.respondentName || 'Respondent'} is dissolved. The parties are restored to the status of unmarried persons.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Arizona property division with community property language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'Pursuant to A.R.S. § 25-318, the Court divides the community property equally as follows:',
      type: 'finding'
    });

    // Property to Petitioner
    items.push({
      content: `IT IS ORDERED that the following community and quasi-community property is awarded to Petitioner ${divorceData.petitionerName || '[PETITIONER NAME]'} as sole and separate property:`,
      type: 'order'
    });

    if (asList(divorceData.petitionerProperty).length > 0) {
      asList(divorceData.petitionerProperty).forEach(prop => {
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
      content: `IT IS ORDERED that the following community and quasi-community property is awarded to Respondent ${divorceData.respondentName || '[RESPONDENT NAME]'} as sole and separate property:`,
      type: 'order'
    });

    if (asList(divorceData.respondentProperty).length > 0) {
      asList(divorceData.respondentProperty).forEach(prop => {
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
      title: 'DIVISION OF COMMUNITY PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Arizona child custody section with Legal Decision-Making terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following orders regarding Legal Decision-Making and Parenting Time are in the best interests of the minor child(ren) pursuant to A.R.S. § 25-403:',
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

    // Legal Decision-Making (Arizona term for custody)
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
        content: `IT IS ORDERED that the parties shall have Joint Legal Decision-Making authority regarding the minor child(ren).`,
        type: 'order'
      });

      items.push({
        content: `IT IS ORDERED that ${resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Petitioner'} shall be the primary residential parent.`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'Petitioner')
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || 'Respondent')
            : (resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Petitioner');
      soleCustodianName = custodianName;
      items.push({
        content: `IT IS ORDERED that ${custodianName} shall have Sole Legal Decision-Making authority regarding the minor child(ren).`,
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

    // Parenting Time (Arizona term for visitation)
    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'LEGAL DECISION-MAKING AND PARENTING TIME',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Arizona parenting time language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    // Parent-time belongs to the NON-residential parent, resolved from
    // primaryResidence/primaryCustodian (role tokens, exact name, unique
    // surname). Unknown residence renders neutral wording, never a guess.
    const nonCustodial = resolveNonResidentialParentName(divorceData);

    return `IT IS ORDERED that ${nonCustodial || 'the non-primary residential parent'} shall have Parenting Time with the minor child(ren) as set forth in the attached Parenting Plan, or if none, reasonable parenting time.`;
  }

  /**
   * Generate Arizona child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Arizona Child Support Guidelines, A.R.S. § 25-320.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be calculated and paid in accordance with the Arizona Child Support Guidelines, A.R.S. § 25-320.`,
        type: 'order'
      });
    }

    // Income withholding
    items.push({
      content: 'An Order of Assignment for child support is issued pursuant to A.R.S. § 25-323.',
      type: 'order'
    });

    // Health insurance
    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || obligor} shall maintain health insurance for the minor child(ren) if available at reasonable cost through an employer or other group plan.`,
      type: 'order'
    });

    // Medical expenses
    items.push({
      content: 'IT IS ORDERED that the parties shall share uninsured and unreimbursed medical, dental, and vision expenses for the minor child(ren) in proportion to their respective incomes.',
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Arizona spousal maintenance section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Spousal maintenance section
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party waives any claim to spousal maintenance from the other, now and in the future.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner';

      items.push({
        content: `The Court, having considered the factors set forth in A.R.S. § 25-319, finds that spousal maintenance is appropriate.`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay spousal maintenance to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month, beginning ${this.formatDate(divorceData.spousalSupportStartDate) || '[DATE]'} and continuing for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
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
   * Generate Arizona name change section
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
   * Generate Arizona final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'Each party shall execute any documents necessary to effectuate this Decree.',
      type: 'order'
    });

    items.push({
      content: 'All relief requested and not specifically granted herein is denied.',
      type: 'order'
    });

    items.push({
      content: 'The Preliminary Injunction entered in this case remains in effect until this Decree is signed, at which time it terminates as to all matters resolved herein.',
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
   * Generate Arizona judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `DATED this _____ day of _______________, 20___.


_________________________________
JUDGE/COMMISSIONER OF THE SUPERIOR COURT

${divorceData.judgeName ? divorceData.judgeName.toUpperCase() : ''}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Arizona-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // Arizona requires county
    if (!divorceData.county) {
      errors.push('County is required for Arizona dissolution decrees');
    }

    // Arizona requires case number for decree
    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Arizona Decree of Dissolution');
    }

    // Warning about 60-day waiting period
    warnings.push('Ensure the 60-day waiting period from service has elapsed before entering this Decree (A.R.S. § 25-329).');

    // Warning about children and PIP
    if (divorceData.hasMinorChildren === true) {
      warnings.push('Both parties must complete the Parent Information Program (PIP) when minor children are involved (A.R.S. § 25-351).');
    }

    // Warning about children
    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    return { errors, warnings };
  }
}

module.exports = ArizonaDivorceDecreeTemplate;
