// templates/states/new_jersey/DivorceDecreeTemplate.js
// New Jersey-specific Judgment of Divorce template
// Complies with N.J.S.A. 2A:34-2 et seq. (New Jersey divorce statutes)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * New Jersey Judgment of Divorce Template
 *
 * Legal References:
 * - N.J.S.A. 2A:34-2 — Grounds for divorce
 * - N.J.S.A. 2A:34-23 — Alimony — types and modification
 * - N.J.S.A. 2A:34-23.1 — Equitable distribution of property
 * - N.J.S.A. 9:2-4 — Child custody — legal and residential custody
 * - N.J. Court Rule 5:6A — New Jersey Child Support Guidelines
 * - N.J. Court Rule 5:5-2 — Case Information Statement
 *
 * New Jersey-Specific Terms:
 * - "Judgment of Divorce" (not Decree; not Final Judgment)
 * - "DOCKET NO." label (format: FM-[county code]-[number]-[year])
 * - "Legal Custody" / "Residential Custody" (not "conservatorship")
 * - "Parenting Time" (not visitation)
 * - "Alimony" (several types: open durational, limited duration, rehabilitative, reimbursement)
 * - Equitable distribution — not community property
 * - Superior Court, Chancery Division, Family Part
 */
class NewJerseyDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'NJ';
    this.stateName = 'New Jersey';
    this.documentTitle = 'JUDGMENT OF DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // New Jersey-specific required fields
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
   * Get New Jersey case number label
   * @returns {string} "DOCKET NO."
   */
  getCaseNumberLabel() {
    return 'DOCKET NO.';
  }

  /**
   * Get default court for New Jersey county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `SUPERIOR COURT OF NEW JERSEY, CHANCERY DIVISION, FAMILY PART, ${countyUpper} COUNTY`;
  }

  /**
   * Generate New Jersey case caption
   * NJ uses Plaintiff/Defendant in divorce proceedings
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `${courtName.toUpperCase()}\n\n`;

    const docketNum = divorceData.caseNumber || '[DOCKET NUMBER]';
    caption += `DOCKET NO. ${docketNum}\n\n`;

    const plaintiff = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const defendant = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    caption += `${plaintiff},\n`;
    caption += `     Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${defendant},\n`;
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
   * Generate New Jersey jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'FINDINGS OF FACT',
      text: `The Court finds that it has jurisdiction over this action and the parties. Plaintiff has satisfied the residency requirements of N.J.S.A. 2A:34-10, having been a bona fide resident of New Jersey for the requisite period prior to filing. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE OF MARRIAGE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The grounds for divorce have been established by competent and credible evidence. The Court finds that the marriage is irretrievably broken and that a divorce should be granted.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate New Jersey dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'JUDGMENT OF DIVORCE',
      text: `IT IS ADJUDGED AND DECREED that the marriage between ${divorceData.petitionerName || 'Plaintiff'} and ${divorceData.respondentName || 'Defendant'} is dissolved and the parties are divorced from the bonds of matrimony.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate New Jersey property division with equitable distribution per N.J.S.A. 2A:34-23.1
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'Having considered the factors set forth in N.J.S.A. 2A:34-23.1 for equitable distribution of marital assets:',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following assets are equitably distributed to ${divorceData.petitionerName || 'Plaintiff'}:`,
        type: 'order'
      });
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    }

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following assets are equitably distributed to ${divorceData.respondentName || 'Defendant'}:`,
        type: 'order'
      });
      divorceData.respondentProperty.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    }

    if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
      items.push({
        content: 'IT IS ORDERED that each party is awarded the personal property currently in that party\'s possession. Each party is awarded any financial accounts held in their sole name.',
        type: 'order'
      });
    }

    items.push({
      content: 'IT IS ORDERED that each party\'s pre-marital property and any property acquired by gift or inheritance during the marriage is confirmed to that party as separate property not subject to equitable distribution.',
      type: 'order'
    });

    return {
      title: 'EQUITABLE DISTRIBUTION OF ASSETS',
      items,
      type: 'property'
    };
  }

  /**
   * Generate New Jersey child custody section
   * Uses NJ "legal custody" / "residential custody" / "parenting time" terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody and parenting time arrangement is in the best interests of the unemancipated child(ren) pursuant to N.J.S.A. 9:2-4:',
      type: 'finding'
    });

    items.push({
      content: 'The unemancipated child(ren) of the marriage are:',
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

    const custodyType = divorceData.custodyType || 'joint';
    const residentialParent = divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff';
    const nonResidentialParent = residentialParent === divorceData.petitionerName
      ? (divorceData.respondentName || 'Defendant')
      : (divorceData.petitionerName || 'Plaintiff');

    if (custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall share joint legal custody of the minor child(ren), with both parents sharing responsibility for major decisions affecting the child(ren)\'s health, education, and welfare.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${residentialParent} shall be the parent of primary residence (residential custodian).`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${residentialParent} shall have sole legal custody of the minor child(ren) and shall be the parent of primary residence.`,
        type: 'order'
      });
    }

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'CUSTODY AND PARENTING TIME',
      items,
      type: 'custody'
    };
  }

  /**
   * Get New Jersey parenting time language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    const nonResidential = divorceData.primaryCustodian === divorceData.petitionerName
      ? (divorceData.respondentName || 'Defendant')
      : (divorceData.petitionerName || 'Plaintiff');
    return `IT IS ORDERED that ${nonResidential}, as the parent of alternate residence, shall have parenting time with the minor child(ren) as set forth in the Parenting Plan incorporated herein, or as otherwise agreed by the parties in writing.`;
  }

  /**
   * Generate New Jersey child support section per N.J. Court Rule 5:6A
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per week/month, calculated in accordance with the New Jersey Child Support Guidelines (N.J. Court Rule 5:6A, Appendix IX-A through IX-H).`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED that child support shall be calculated and paid in accordance with the New Jersey Child Support Guidelines (N.J. Court Rule 5:6A, Appendix IX-A through IX-H), based upon the parties\' incomes as set forth in the Child Support Guideline Worksheet filed herein.',
        type: 'order'
      });
    }

    items.push({
      content: 'IT IS ORDERED that child support shall be paid through the New Jersey Family Support Payment Center (NJFSPC) by income withholding pursuant to N.J.S.A. 2A:17-56.9.',
      type: 'order'
    });

    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || obligor} shall maintain health insurance coverage for the unemancipated child(ren) if available at a reasonable cost. Uncovered medical expenses shall be divided between the parties in proportion to their respective net incomes.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate New Jersey alimony section per N.J.S.A. 2A:34-23
   * NJ uses "alimony" not "spousal support" or "maintenance"
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
        content: 'IT IS ORDERED that each party waives any and all right to alimony from the other, past, present, and future, and the Court shall not retain jurisdiction to award alimony in the future.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Plaintiff';
      const alimonyType = divorceData.alimonyType || 'limited_duration';

      items.push({
        content: 'The Court, having considered the factors set forth in N.J.S.A. 2A:34-23(b) for alimony, finds that an award of alimony is appropriate:',
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay ${alimonyType.replace('_', ' ')} alimony to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month, commencing ${this.formatDate(divorceData.spousalSupportStartDate) || '[DATE]'}, and continuing for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });

      items.push({
        content: 'Alimony shall terminate upon the death of either party, the remarriage of the recipient, or cohabitation of the recipient with another person in a relationship similar to marriage, pursuant to N.J.S.A. 2A:34-23.',
        type: 'order'
      });

      if (!divorceData.nonModifiable) {
        items.push({
          content: 'The Court retains jurisdiction to modify alimony upon a showing of substantial change in circumstances.',
          type: 'order'
        });
      }
    }

    return {
      title: 'ALIMONY',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate New Jersey name change section
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
      text: `IT IS ORDERED that the former name of ${person} is restored to: ${divorceData.previousName}.`,
      type: 'name_change'
    };
  }

  /**
   * Generate New Jersey final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that all relief not specifically granted herein is denied.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that this Judgment of Divorce is a final judgment disposing of all claims between the parties in this action.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute and deliver any documents necessary to effectuate the terms of this Judgment.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall bear their own attorney\'s fees and costs, unless otherwise specified herein.',
      type: 'order'
    });

    items.push({
      content: 'The Court retains jurisdiction to enforce and, where permitted by law, to modify the provisions of this Judgment.',
      type: 'order'
    });

    return {
      title: 'MISCELLANEOUS PROVISIONS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate New Jersey judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `ORDERED AND ADJUDGED this _____ day of _______________, 20___.


_________________________________
J.S.C.
${divorceData.county ? `SUPERIOR COURT OF NEW JERSEY\nCHANCERY DIVISION, FAMILY PART\n${divorceData.county.toUpperCase()} COUNTY` : 'SUPERIOR COURT OF NEW JERSEY\nCHANCERY DIVISION, FAMILY PART'}`,
      type: 'judgment'
    };
  }

  /**
   * Generate New Jersey effective date text
   * @returns {string} Effective date language
   */
  getEffectiveDateText() {
    return 'This Judgment of Divorce is effective upon entry by the Court.';
  }

  /**
   * Perform New Jersey-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for New Jersey divorce judgments');
    }

    if (!divorceData.caseNumber) {
      errors.push('Docket number is required for New Jersey Judgment of Divorce');
    }

    warnings.push('New Jersey requires a Case Information Statement (CIS) from both parties (N.J. Court Rule 5:5-2).');

    if (divorceData.hasMinorChildren === true) {
      warnings.push('New Jersey requires a Parenting Plan to be filed when minor children are involved.');
      warnings.push('A Child Support Guideline Worksheet must be filed pursuant to N.J. Court Rule 5:6A.');
    }

    return { errors, warnings };
  }
}

module.exports = NewJerseyDivorceDecreeTemplate;
