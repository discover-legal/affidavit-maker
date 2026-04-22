// templates/states/kentucky/DivorceDecreeTemplate.js
// Kentucky Decree of Dissolution of Marriage template
// Complies with KRS 403.140 et seq. (Dissolution of Marriage)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Kentucky Decree of Dissolution of Marriage Template
 *
 * Legal References:
 * - KRS 403.140 — Jurisdiction (180-day residency)
 * - KRS 403.170 — Grounds (irretrievable breakdown); 60-day waiting period
 * - KRS 403.190 — Disposition of marital property (equitable distribution)
 * - KRS 403.200 — Maintenance
 * - KRS 403.270 — Child custody (joint and sole)
 * - KRS 403.320 — Timesharing and visitation
 * - KRS 403.211 et seq. — Child support guidelines
 *
 * Kentucky-Specific Terms:
 * - "Decree of Dissolution of Marriage" (not Final Decree of Divorce)
 * - "CASE NO." label
 * - "Joint Custody" / "Sole Custody" (not parental responsibilities)
 * - "Timesharing" / "Visitation" (not parenting time)
 * - "Maintenance" (not alimony or spousal support)
 * - Equitable distribution (NOT community property)
 * - Family Court (where established) or Circuit Court
 * - Kentucky is a Commonwealth — header uses "COMMONWEALTH OF KENTUCKY"
 */
class KentuckyDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'KY';
    this.stateName = 'Kentucky';
    this.documentTitle = 'DECREE OF DISSOLUTION OF MARRIAGE';

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
   * Get Kentucky case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Kentucky county — Family Court or Circuit Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Family Court, ${countyName} County, Kentucky`;
  }

  /**
   * Generate Kentucky header — Commonwealth
   * @returns {string} Header text
   */
  generateHeader() {
    return 'COMMONWEALTH OF KENTUCKY';
  }

  /**
   * Generate Kentucky venue — title case
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Generate Kentucky title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Kentucky
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Decree is entered by the Court';
  }

  /**
   * Generate Kentucky appearances section
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

    text += `\n\nThe Court, having considered the evidence and applicable law, enters the following Decree:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Kentucky jurisdiction section — 180-day residency
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. At least one of the parties has been a resident of the Commonwealth of Kentucky for at least one hundred eighty (180) days preceding the filing of the petition. (KRS 403.140) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The marriage is irretrievably broken. At least sixty (60) days have elapsed since the date the petition was filed. (KRS 403.170)`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Kentucky dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DECREE OF DISSOLUTION',
      text: `IT IS ORDERED, ADJUDGED, AND DECREED that the marriage of ${divorceData.petitionerName || '[PETITIONER NAME]'} and ${divorceData.respondentName || '[RESPONDENT NAME]'} is hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Kentucky property division — equitable distribution; "marital property" in "just proportions"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in KRS 403.190 and orders a division of marital property in just proportions as follows:',
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
   * Generate Kentucky child custody section — uses "Joint Custody" and "Sole Custody"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody arrangement is in the best interests of the child(ren) pursuant to KRS 403.270:',
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
        content: `IT IS ORDERED that the parties shall have joint custody of the minor child(ren). The primary residential parent is ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'}.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have sole custody of the minor child(ren).`,
        type: 'order'
      });
    }

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'CHILD CUSTODY',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Kentucky timesharing/visitation language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Timesharing language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the non-residential parent shall have timesharing and visitation with the minor child(ren) as agreed by the parties or, in the absence of agreement, as set forth in the timesharing schedule attached hereto and incorporated herein by reference. (KRS 403.320)`;
  }

  /**
   * Generate Kentucky child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Kentucky Child Support Guidelines, KRS 403.211.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Kentucky Child Support Guidelines, KRS 403.211. The parties shall complete a Child Support Worksheet (AOC-238).`,
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
   * Generate Kentucky maintenance section — "Maintenance" not "Alimony"
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
        content: `The Court, having considered the factors set forth in KRS 403.200, orders maintenance as follows:`,
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
   * Generate Kentucky judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `DONE AND ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE
FAMILY COURT / CIRCUIT COURT
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY, KENTUCKY` : '[COUNTY] COUNTY, KENTUCKY'}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Kentucky-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Kentucky Decree of Dissolution of Marriage');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Kentucky dissolution decree');
    }

    warnings.push('Ensure at least 60 days have elapsed from the date the petition was filed before entering the decree. (KRS 403.170)');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A completed Child Support Worksheet (AOC-238) must be attached when minor children are involved. (KRS 403.211)');
      warnings.push('A timesharing/visitation schedule must be attached. (KRS 403.320)');
    }

    return { errors, warnings };
  }
}

module.exports = KentuckyDivorceDecreeTemplate;
