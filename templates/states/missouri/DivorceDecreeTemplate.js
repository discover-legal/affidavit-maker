// templates/states/missouri/DivorceDecreeTemplate.js
// Missouri Judgment of Dissolution of Marriage template
// Complies with RSMo Chapter 452 (Dissolution of Marriage)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Missouri Judgment of Dissolution of Marriage Template
 *
 * Legal References:
 * - RSMo 452.305 — 90-day residency; 30-day waiting period
 * - RSMo 452.320 — Grounds (irretrievably broken — only ground)
 * - RSMo 452.330 — Disposition of property (equitable distribution)
 * - RSMo 452.335 — Maintenance
 * - RSMo 452.375 — Custody (legal and physical; joint and sole)
 * - RSMo 452.310 — Parenting plan requirement
 * - RSMo 452.340 — Child support guidelines (Form 14)
 *
 * Missouri-Specific Terms:
 * - "Judgment of Dissolution of Marriage" (not Decree or Final Decree)
 * - "CASE NO." label
 * - "Legal Custody" / "Physical Custody"; "Joint" / "Sole"
 * - "Maintenance" (not alimony or spousal support)
 * - Equitable distribution (NOT community property)
 * - Circuit Court
 */
class MissouriDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'MO';
    this.stateName = 'Missouri';
    this.documentTitle = 'JUDGMENT OF DISSOLUTION OF MARRIAGE';

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
   * Get Missouri case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Missouri county — Circuit Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Circuit Court of ${countyName} County, Missouri`;
  }

  /**
   * Generate Missouri header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MISSOURI';
  }

  /**
   * Generate Missouri venue — title case
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Generate Missouri title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Missouri
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Judgment is entered by the Court';
  }

  /**
   * Generate Missouri appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This cause came on for hearing before the Court.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Petitioner, ${divorceData.petitionerName || '[PETITIONER NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se (self-represented)'}.\n\n`;
      text += `Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, ${divorceData.respondentAppeared ? 'appeared and announced agreement' : 'having been duly served, did not appear'}.`;
    } else {
      text += `Petitioner appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se'}.\n\n`;
      text += `Respondent ${divorceData.respondentAppeared ? 'appeared' : 'did not appear'}.`;
    }

    text += `\n\nThe Court, having considered the evidence, the pleadings, and applicable law, enters the following Judgment:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Missouri jurisdiction section — 90-day state residency
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. At least one party has been a resident of Missouri for at least ninety (90) days preceding the filing of the petition. (RSMo 452.305) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The marriage is irretrievably broken and there remains no reasonable likelihood that the marriage can be preserved. (RSMo 452.320) At least thirty (30) days have elapsed since the date the petition was filed. (RSMo 452.305)`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Missouri dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'JUDGMENT OF DISSOLUTION',
      text: `IT IS ORDERED, ADJUDGED, AND DECREED that the marriage of ${divorceData.petitionerName || '[PETITIONER NAME]'} and ${divorceData.respondentName || '[RESPONDENT NAME]'} is hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Missouri property division — equitable distribution of marital property
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in RSMo 452.330 and orders the following division of marital property:',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following marital property is awarded to ${divorceData.petitionerName || 'Petitioner'} as that party's sole and separate property:`,
        type: 'order'
      });
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following marital property is awarded to ${divorceData.respondentName || 'Respondent'} as that party's sole and separate property:`,
        type: 'order'
      });
      divorceData.respondentProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
      items.push({
        content: `IT IS ORDERED that each party is awarded the marital personal property currently in that party's possession as that party's sole and separate property.`,
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that each party's non-marital (separate) property is set apart to that party.`,
      type: 'order'
    });

    return {
      title: 'DIVISION OF MARITAL PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Missouri child custody section — "Legal Custody" and "Physical Custody"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody arrangement is in the best interests of the child(ren) pursuant to RSMo 452.375:',
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

    const custodyType = divorceData.custodyType || 'joint';

    if (custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall have joint legal and joint physical custody of the minor child(ren). ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} is designated as the residential parent for purposes of school enrollment.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have sole legal and sole physical custody of the minor child(ren).`,
        type: 'order'
      });
    }

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'CUSTODY',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Missouri parenting plan language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting plan language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the Parenting Plan attached hereto and incorporated herein by reference is approved and shall govern the custody, visitation, and parenting time schedule as set forth therein. (RSMo 452.310)`;
  }

  /**
   * Generate Missouri child support section — Form 14
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, as calculated on the Form 14 Child Support Amount Calculation in accordance with Missouri Supreme Court Rule 88.01 and RSMo 452.340.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Missouri Child Support Guidelines, RSMo 452.340. The parties shall complete a Form 14 Child Support Amount Calculation per Missouri Supreme Court Rule 88.01.`,
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
   * Generate Missouri maintenance section — "Maintenance" not "Alimony"
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
        content: 'IT IS ORDERED that each party waives and relinquishes any claim for maintenance from the other party, now and forever.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner';

      items.push({
        content: `The Court, having considered the factors set forth in RSMo 452.335, orders maintenance as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay maintenance to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return {
      title: 'MAINTENANCE',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Missouri judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `SO ORDERED, ADJUDGED, AND DECREED this _____ day of _______________, 20___.



_________________________________
CIRCUIT JUDGE
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY, MISSOURI` : '[COUNTY] COUNTY, MISSOURI'}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Missouri-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Missouri Judgment of Dissolution of Marriage');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Missouri dissolution judgment');
    }

    warnings.push('Ensure 30 days have elapsed from filing before entering the judgment. (RSMo 452.305)');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A completed Parenting Plan (RSMo 452.310) must be attached when minor children are involved.');
      warnings.push('A completed Form 14 Child Support Amount Calculation must be attached per Missouri Supreme Court Rule 88.01.');
    }

    return { errors, warnings };
  }
}

module.exports = MissouriDivorceDecreeTemplate;
