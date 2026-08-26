// templates/states/ohio/DivorceDecreeTemplate.js
// Ohio-specific Judgment Entry-Decree of Divorce template
// Complies with R.C. § 3105.01 et seq. (Ohio Divorce statutes)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

/**
 * Ohio Judgment Entry-Decree of Divorce Template
 *
 * Legal References:
 * - R.C. § 3105.01 — Grounds for divorce
 * - R.C. § 3105.171 — Division of marital and separate property (equitable distribution)
 * - R.C. § 3105.18 — Spousal support
 * - R.C. § 3109.04 — Parental rights and responsibilities; shared parenting
 * - R.C. § 3119.02 — Ohio Child Support Guidelines (basic support obligation)
 * - R.C. § 3119.022 — Child support computation worksheet
 * - R.C. § 3121.03 — Income withholding for child support
 *
 * Ohio-Specific Terms:
 * - "Judgment Entry-Decree of Divorce" (Ohio DR form title; R.C. § 3105.171)
 * - "CASE NO." label
 * - "Parental Rights and Responsibilities" (not custody)
 * - "Parenting Time" (not visitation)
 * - "Spousal Support" (not alimony or maintenance)
 * - Equitable distribution — not community property
 * - Court of Common Pleas, Domestic Relations Division
 */
class OhioDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'OH';
    this.stateName = 'Ohio';
    this.documentTitle = 'JUDGMENT ENTRY-DECREE OF DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Ohio-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'caseNumber',
      'marriageDate'
    ];
  }

  /**
   * Get Ohio case number label
   * @returns {string} "CASE NO."
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Ohio county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COURT OF COMMON PLEAS, ${countyUpper} COUNTY, OHIO, DOMESTIC RELATIONS DIVISION`;
  }

  /**
   * Generate Ohio case caption
   * Uses Plaintiff/Defendant terminology (Ohio uses these for divorce, not Petitioner/Respondent)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `IN THE ${courtName.toUpperCase()}\n\n`;

    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `CASE NO. ${caseNumber}\n\n`;

    const petitioner = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    caption += `${petitioner},\n`;
    caption += `     Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${respondent},\n`;
    caption += `     Defendant.`;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Ohio jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    const groundsText = divorceData.divorceGrounds === 'incompatibility'
      ? 'The Court finds the grounds of incompatibility, as the parties are incompatible with each other and a legitimate marital relationship no longer exists. (R.C. § 3105.01(K))'
      : divorceData.divorceGrounds === 'separation'
        ? 'The Court finds the grounds of living separate and apart without cohabitation for more than one (1) year. (R.C. § 3105.01(J))'
        : `The Court finds that grounds for divorce have been established by the evidence${divorceData.divorceGrounds ? ` (${divorceData.divorceGrounds})` : ' pursuant to R.C. § 3105.01'}.`;

    return {
      title: 'FINDINGS OF FACT',
      text: `The Court finds that it has jurisdiction over the parties and the subject matter of this action. Plaintiff has satisfied the residency requirements of R.C. § 3105.03, having been a resident of Ohio for at least six (6) months and a resident of ${divorceData.county || '[COUNTY]'} County for at least ninety (90) days immediately preceding the filing of the Complaint. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE OF MARRIAGE]'}${divorceData.separationDate ? ` and have been living separate and apart since on or about ${this.formatDate(divorceData.separationDate)}` : ''}. ${groundsText} This cause was heard no sooner than forty-two (42) days after service of process on Defendant, as required by R.C. § 3105.10.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Ohio dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DIVORCE GRANTED',
      text: `IT IS ORDERED AND DECREED that the bonds of matrimony existing between ${divorceData.petitionerName || 'Plaintiff'} and ${divorceData.respondentName || 'Defendant'} are dissolved, and the parties are hereby divorced.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Ohio property division with equitable distribution language per R.C. § 3105.171
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'Pursuant to R.C. § 3105.171, the Court has divided the marital property in an equitable manner, having considered all relevant factors:',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following marital property is awarded to ${divorceData.petitionerName || 'Plaintiff'} as that party\'s sole property, free and clear of any claim of the other party:`,
        type: 'order'
      });
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    }

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following marital property is awarded to ${divorceData.respondentName || 'Defendant'} as that party\'s sole property, free and clear of any claim of the other party:`,
        type: 'order'
      });
      divorceData.respondentProperty.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    }

    if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
      items.push({
        content: 'IT IS ORDERED that each party is awarded the personal property currently in that party\'s possession as their separate property. Each party is awarded the financial accounts held solely in their own name.',
        type: 'order'
      });
    }

    items.push({
      content: 'IT IS ORDERED that each party\'s separate property, as defined by R.C. § 3105.171(A)(6), is confirmed to that party free of any claim by the other.',
      type: 'order'
    });

    return {
      title: 'DIVISION OF MARITAL PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Ohio parental rights and responsibilities section
   * Uses Ohio-specific terminology per R.C. § 3109.04
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following allocation of parental rights and responsibilities is in the best interests of the minor child(ren), considering the factors set forth in R.C. § 3109.04(F):',
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

    // Safety rule (mirrors the base class): only positively recognized
    // custody values render a joint or sole order. Legacy free text like
    // "joint decision making" maps to the joint branch; anything ambiguous
    // renders neutral as-agreed language with a placeholder — NEVER a sole
    // order (see templates/core/parenting.js).
    const custody = resolveCustodyArrangement(divorceData);
    const residenceName = resolvePrimaryResidenceName(divorceData);
    let soleCustodianName = null;
    const primaryParent =
      custody.kind === 'sole_petitioner'
        ? (divorceData.petitionerName || 'Plaintiff')
        : custody.kind === 'sole_respondent'
          ? (divorceData.respondentName || 'Defendant')
          : (divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff');
    const otherParent = primaryParent === divorceData.petitionerName
      ? (divorceData.respondentName || 'Defendant')
      : (divorceData.petitionerName || 'Plaintiff');

    if (custody.kind === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall share parental rights and responsibilities pursuant to a Shared Parenting Plan as filed with and approved by this Court. (R.C. § 3109.04(D))`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${primaryParent} is designated the residential parent for school purposes.`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      soleCustodianName = primaryParent;
      items.push({
        content: `IT IS ORDERED that ${primaryParent} is designated the sole residential parent and legal custodian of the minor child(ren). (R.C. § 3109.04(A)(1))`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${otherParent} shall have parenting time with the minor child(ren) pursuant to the Standard Parenting Time Schedule or as otherwise agreed by the parties.`,
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

    return {
      title: 'PARENTAL RIGHTS AND RESPONSIBILITIES',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Ohio parenting time language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    const nonResidential = divorceData.primaryCustodian === divorceData.petitionerName
      ? (divorceData.respondentName || 'Defendant')
      : (divorceData.petitionerName || 'Plaintiff');
    return `IT IS ORDERED that ${nonResidential} shall have parenting time with the minor child(ren) at times and places mutually agreed upon by the parties, or in accordance with the Court's Standard Order of Parenting Time if the parties cannot agree.`;
  }

  /**
   * Generate Ohio child support section per R.C. § 3119.021
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child support section
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];
    const obligor = divorceData.childSupportObligor || divorceData.respondentName || 'Defendant';
    const obligee = divorceData.childSupportObligee || divorceData.petitionerName || 'Plaintiff';

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Ohio Child Support Guidelines, R.C. § 3119.02, per child support computation worksheet (R.C. § 3119.022) attached hereto.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED that child support shall be calculated and paid in accordance with the Ohio Child Support Guidelines (R.C. § 3119.02), per the child support computation worksheet (R.C. § 3119.022) filed with this Court.',
        type: 'order'
      });
    }

    items.push({
      content: 'IT IS ORDERED that child support shall be paid through income withholding pursuant to R.C. § 3121.03, through the Ohio Child Support Payment Central (CSPC) as directed by the Child Support Enforcement Agency.',
      type: 'order'
    });

    items.push({
      content: `IT IS ORDERED that ${obligor} shall maintain health insurance for the minor child(ren) if available at a reasonable cost through an employer or group plan. Unreimbursed medical, dental, optical, and pharmaceutical expenses shall be divided as follows: ${divorceData.medicalExpenseSplit || '50% by each party'}.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Ohio spousal support section per R.C. § 3105.18
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
        content: 'IT IS ORDERED that each party waives any and all claims to spousal support from the other party, now and forever, and the Court shall not retain jurisdiction to award spousal support in the future.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Plaintiff';

      items.push({
        content: 'The Court, having considered the factors set forth in R.C. § 3105.18(C), finds that an award of spousal support is appropriate and reasonable:',
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay spousal support to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}, or until further order of this Court.`,
        type: 'order'
      });

      if (!divorceData.nonModifiable) {
        items.push({
          content: 'The Court retains jurisdiction to modify the amount and/or duration of spousal support upon a change of circumstances pursuant to R.C. § 3105.18(E).',
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
   * Generate Ohio name change section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Name change section
   */
  generateNameChangeSection(divorceData) {
    if (!divorceData.requestNameChange || !divorceData.previousName) {
      return null;
    }

    const person = divorceData.nameChangeParty || divorceData.petitionerName || 'Plaintiff';

    return {
      title: 'RESTORATION OF FORMER NAME',
      text: `IT IS ORDERED that the former name of ${person} is restored to: ${divorceData.previousName}. This restoration is effective upon the journalization of this Decree.`,
      type: 'name_change'
    };
  }

  /**
   * Generate Ohio final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that all relief requested in this action and not expressly granted herein is denied.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that this Decree is a final judgment disposing of all claims in this action. This Decree shall be effective upon journalization by this Court.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute any and all documents necessary to carry out the terms and provisions of this Decree.',
      type: 'order'
    });

    items.push({
      content: 'This Court retains jurisdiction to enforce and, where permitted by law, to modify the terms of this Decree.',
      type: 'order'
    });

    return {
      title: 'MISCELLANEOUS ORDERS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate Ohio judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `IT IS SO ORDERED AND DECREED.

ENTERED AND JOURNALIZED this _____ day of _______________, 20___.


_________________________________
JUDGE, COURT OF COMMON PLEAS
DOMESTIC RELATIONS DIVISION
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY, OHIO` : '[COUNTY] COUNTY, OHIO'}`,
      type: 'judgment'
    };
  }

  /**
   * Generate Ohio effective date text
   * @returns {string} Effective date language
   */
  getEffectiveDateText() {
    return 'This Judgment Entry-Decree of Divorce is effective upon journalization by the Court.';
  }

  /**
   * Perform Ohio-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Ohio divorce decrees');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Ohio Judgment Entry Decree of Divorce');
    }

    if (divorceData.hasMinorChildren === true) {
      warnings.push('Ohio requires a child support computation worksheet (R.C. § 3119.022) to be filed with the Decree, with support calculated pursuant to the Ohio Child Support Schedule (R.C. § 3119.02).');
      if (resolveCustodyArrangement(divorceData).kind === 'joint') {
        warnings.push('Ohio requires an approved Shared Parenting Plan to be filed with and incorporated into the Decree (R.C. § 3109.04(D)).');
      }
    }

    return { errors, warnings };
  }
}

module.exports = OhioDivorceDecreeTemplate;
