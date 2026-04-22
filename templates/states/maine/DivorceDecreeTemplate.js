// templates/states/maine/DivorceDecreeTemplate.js
// Maine Judgment of Divorce template
// Complies with 19-A M.R.S. §901 et seq. (Divorce)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Maine Judgment of Divorce Template
 *
 * Legal References:
 * - 19-A M.R.S. §901 — Jurisdiction and residency
 * - 19-A M.R.S. §902 — Grounds (irreconcilable marital differences); 60-day waiting period
 * - 19-A M.R.S. §953 — Division of marital property (equitable distribution)
 * - 19-A M.R.S. §951-A — Spousal support (general, transitional, reimbursement, nominal)
 * - 19-A M.R.S. §1501 et seq. — Parental rights and responsibilities
 * - 19-A M.R.S. §2001 et seq. — Maine Child Support Guidelines
 *
 * Maine-Specific Terms:
 * - "Judgment of Divorce"
 * - "DOCKET NO." label
 * - "Parental Rights and Responsibilities" (NOT "custody")
 * - "Parent-Child Contact" (NOT "visitation")
 * - "Spousal Support" — 4 types: general, transitional, reimbursement, nominal
 * - Equitable distribution of marital property
 * - District Court, Family Division
 */
class MaineDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'ME';
    this.stateName = 'Maine';
    this.documentTitle = 'JUDGMENT OF DIVORCE';

    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

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
   * Get Maine case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'DOCKET NO.';
  }

  /**
   * Get default court for Maine county — District Court, Family Division
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court, Family Division, ${countyName} County, Maine`;
  }

  /**
   * Generate Maine header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MAINE';
  }

  /**
   * Generate Maine venue — title case
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Generate Maine title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Maine
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Judgment is entered by the Court';
  }

  /**
   * Generate Maine appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This matter came before the Court for hearing.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Plaintiff, ${divorceData.petitionerName || '[PLAINTIFF NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se (self-represented)'}.\n\n`;
      text += `Defendant, ${divorceData.respondentName || '[DEFENDANT NAME]'}, ${divorceData.respondentAppeared ? 'appeared and announced agreement' : 'having been duly served, did not appear'}.`;
    } else {
      text += `Plaintiff appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se'}.\n\n`;
      text += `Defendant ${divorceData.respondentAppeared ? 'appeared' : 'did not appear'}.`;
    }

    text += `\n\nThe Court, having considered the evidence and applicable law, enters the following Judgment:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Maine jurisdiction section — 6-month residency
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. At least one party has been a resident of the State of Maine for at least six (6) months immediately preceding the filing of the complaint. (19-A M.R.S. §901) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. There exist irreconcilable marital differences between the parties. (19-A M.R.S. §902) At least sixty (60) days have elapsed since service of the summons and complaint. (19-A M.R.S. §902)`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Maine dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'JUDGMENT OF DIVORCE',
      text: `IT IS ORDERED, ADJUDGED, AND DECREED that the marriage of ${divorceData.petitionerName || '[PLAINTIFF NAME]'} and ${divorceData.respondentName || '[DEFENDANT NAME]'} is hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Maine property division — equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in 19-A M.R.S. §953 and orders the following equitable division of marital property:',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Plaintiff'} as that party's sole and separate property:`,
        type: 'order'
      });
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Defendant'} as that party's sole and separate property:`,
        type: 'order'
      });
      divorceData.respondentProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
      items.push({
        content: `IT IS ORDERED that each party is awarded the personal property currently in that party's possession as that party's sole and separate property.`,
        type: 'order'
      });
    }

    return {
      title: 'DIVISION OF MARITAL PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Maine parental rights and responsibilities section
   * Uses "Parental Rights and Responsibilities" (NOT "custody")
   * Uses "Parent-Child Contact" (NOT "visitation")
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Parental rights section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following allocation of parental rights and responsibilities is in the best interests of the child(ren) pursuant to 19-A M.R.S. §1501 et seq.:',
      type: 'finding'
    });

    items.push({
      content: 'The minor child(ren) of this marriage:',
      type: 'order'
    });

    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate) || '[BIRTH DATE]'}`;
      items.push({
        content: `${index + 1}. ${childInfo}`,
        type: 'child_item'
      });
    });

    const custodyType = divorceData.custodyType || 'shared';

    if (custodyType === 'shared' || custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall share parental rights and responsibilities for the minor child(ren). ${divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff'} shall be the primary residential parent.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff'} shall have sole parental rights and responsibilities for the minor child(ren).`,
        type: 'order'
      });
    }

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'PARENTAL RIGHTS AND RESPONSIBILITIES',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Maine parent-child contact language (NOT "visitation")
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parent-child contact language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the non-residential parent shall have parent-child contact as agreed by the parties or as otherwise ordered by the Court, pursuant to 19-A M.R.S. §1501 et seq.`;
  }

  /**
   * Generate Maine child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Maine Child Support Guidelines, 19-A M.R.S. §2001 et seq.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Maine Child Support Guidelines, 19-A M.R.S. §2001 et seq. The parties shall complete a Child Support Affidavit.`,
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${obligor} shall maintain health insurance coverage for the minor child(ren) if available at a reasonable cost through employment or otherwise.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Maine spousal support section — "Spousal Support" (4 types)
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
        content: 'IT IS ORDERED that each party waives and relinquishes any claim for spousal support from the other party, now and forever.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Plaintiff';
      const supportType = divorceData.spousalSupportType || 'general';

      items.push({
        content: `The Court, having considered the factors set forth in 19-A M.R.S. §951-A, orders ${supportType} spousal support as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay ${supportType} spousal support to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return {
      title: 'SPOUSAL SUPPORT',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Maine judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `SO ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE
DISTRICT COURT, FAMILY DIVISION
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY` : '[COUNTY] COUNTY'}
STATE OF MAINE`,
      type: 'judgment'
    };
  }

  /**
   * Perform Maine-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Maine Judgment of Divorce');
    }

    if (!divorceData.caseNumber) {
      errors.push('Docket number is required for Maine divorce judgment');
    }

    warnings.push('Ensure 60 days have elapsed from service before entering the judgment. (19-A M.R.S. §902)');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A completed Child Support Affidavit must be attached per 19-A M.R.S. §2001 et seq.');
      warnings.push('An order on parental rights and responsibilities must be incorporated into the judgment.');
      warnings.push('Maine uses "parental rights and responsibilities" (not "custody") and "parent-child contact" (not "visitation").');
    }

    return { errors, warnings };
  }
}

module.exports = MaineDivorceDecreeTemplate;
