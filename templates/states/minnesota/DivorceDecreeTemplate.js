// templates/states/minnesota/DivorceDecreeTemplate.js
// Minnesota Judgment and Decree template
// Complies with Minn. Stat. § 518.06 et seq. (Marriage Dissolution)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Minnesota Judgment and Decree Template
 *
 * Legal References:
 * - Minn. Stat. § 518.06 — Grounds (irretrievable breakdown)
 * - Minn. Stat. § 518.07 — Jurisdiction (180-day residency)
 * - Minn. Stat. § 518.58 — Disposition of marital property (equitable distribution)
 * - Minn. Stat. § 518.552 — Spousal maintenance
 * - Minn. Stat. § 518.17 — Best interests of child / custody
 * - Minn. Stat. § 518A.26 et seq. — Child support guidelines
 *
 * Minnesota-Specific Terms:
 * - "Judgment and Decree" (not Final Decree of Divorce)
 * - "COURT FILE NO." label
 * - "Legal Custody" / "Physical Custody" (joint custody common)
 * - "Parenting Time" (not visitation)
 * - "Spousal Maintenance" (not alimony)
 * - Equitable distribution (NOT community property)
 * - District Court (Family Court Division)
 */
class MinnesotaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'MN';
    this.stateName = 'Minnesota';
    this.documentTitle = 'JUDGMENT AND DECREE';

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
   * Get Minnesota case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'COURT FILE NO.';
  }

  /**
   * Get default court for Minnesota county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court, ${countyName} County, Minnesota`;
  }

  /**
   * Generate Minnesota header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MINNESOTA';
  }

  /**
   * Generate Minnesota venue — title case
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Generate Minnesota title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Minnesota
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Judgment and Decree is entered by the Court';
  }

  /**
   * Generate Minnesota appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This matter came before the Court for hearing.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Petitioner, ${divorceData.petitionerName || '[PETITIONER NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se (self-represented)'}.\n\n`;
      text += `Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, ${divorceData.respondentAppeared ? 'appeared and announced agreement' : 'having been duly served, did not appear'}.`;
    } else {
      text += `Petitioner appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se'}.\n\n`;
      text += `Respondent ${divorceData.respondentAppeared ? 'appeared' : 'did not appear'}.`;
    }

    text += `\n\nThe Court, having considered the evidence and applicable law, enters the following Judgment and Decree:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Minnesota jurisdiction section — 180-day residency
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. At least one of the parties has resided in Minnesota for at least one hundred eighty (180) days preceding the filing of the petition. (Minn. Stat. § 518.07) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The marriage relationship is irretrievably broken and there is no reasonable prospect of reconciliation.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Minnesota dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DISSOLUTION OF MARRIAGE',
      text: `IT IS ORDERED, ADJUDGED, AND DECREED that the marriage of ${divorceData.petitionerName || '[PETITIONER NAME]'} and ${divorceData.respondentName || '[RESPONDENT NAME]'} is hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Minnesota property division — equitable distribution; "marital property"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in Minn. Stat. § 518.58 and orders a just and equitable division of marital property as follows:',
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
      content: `IT IS ORDERED that each party's non-marital (separate) property is confirmed to that party.`,
      type: 'order'
    });

    return {
      title: 'DIVISION OF MARITAL PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Minnesota child custody section — uses "Legal Custody" and "Physical Custody"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody arrangement is in the best interests of the child(ren) pursuant to Minn. Stat. § 518.17:',
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
        content: `IT IS ORDERED that the parties shall share joint legal custody and joint physical custody of the minor child(ren). The primary residential parent is ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'}.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have sole legal custody and sole physical custody of the minor child(ren).`,
        type: 'order'
      });
    }

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'CHILD CUSTODY AND PARENTING TIME',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Minnesota parenting time language (replaces "visitation")
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the parenting time schedule shall be as agreed by the parties or, in the absence of agreement, as set forth in the Parenting Plan attached hereto and incorporated herein by reference.`;
  }

  /**
   * Generate Minnesota child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Minnesota Child Support Guidelines, Minn. Stat. § 518A.26.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Minnesota Child Support Guidelines, Minn. Stat. § 518A.26. The parties shall complete a Child Support Worksheet.`,
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${obligor} shall maintain health insurance coverage for the minor child(ren) if available at a reasonable cost through employment or other group plan.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Minnesota spousal maintenance section — "Spousal Maintenance" not "Alimony"
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
        content: 'IT IS ORDERED that each party waives and relinquishes any claim for spousal maintenance from the other party, now and forever.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner';

      items.push({
        content: `The Court, having considered the factors set forth in Minn. Stat. § 518.552, orders spousal maintenance as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay spousal maintenance to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
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
   * Generate Minnesota judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `DONE AND ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE OF DISTRICT COURT
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY, MINNESOTA` : '[COUNTY] COUNTY, MINNESOTA'}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Minnesota-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Minnesota Judgment and Decree');
    }

    if (!divorceData.caseNumber) {
      errors.push('Court file number is required for Minnesota dissolution decree');
    }

    warnings.push('Ensure at least one party has resided in Minnesota for 180 days before filing. (Minn. Stat. § 518.07)');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A completed Parenting Plan must be attached when minor children are involved.');
      warnings.push('A completed Child Support Worksheet must be attached. (Minn. Stat. § 518A.26)');
    }

    return { errors, warnings };
  }
}

module.exports = MinnesotaDivorceDecreeTemplate;
