// templates/states/colorado/DivorceDecreeTemplate.js
// Colorado Decree of Dissolution of Marriage template
// Complies with C.R.S. § 14-10-101 et seq. (Uniform Dissolution of Marriage Act)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Colorado Decree of Dissolution of Marriage Template
 *
 * Legal References:
 * - C.R.S. § 14-10-101 et seq. — Uniform Dissolution of Marriage Act
 * - C.R.S. § 14-10-106 — Grounds (irretrievable breakdown); 91-day waiting period
 * - C.R.S. § 14-10-113 — Disposition of property (equitable distribution)
 * - C.R.S. § 14-10-114 — Maintenance
 * - C.R.S. § 14-10-124 — Best interests of child / parental responsibilities
 * - C.R.S. § 14-10-115 — Child support guidelines
 *
 * Colorado-Specific Terms:
 * - "Decree of Dissolution of Marriage" (not Final Decree of Divorce)
 * - "CASE NO." label
 * - "Parental Responsibilities" / "Parenting Time" (not custody / visitation)
 * - "Maintenance" (not alimony or spousal support)
 * - Equitable distribution (NOT community property)
 * - District Court
 */
class ColoradoDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'CO';
    this.stateName = 'Colorado';
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
   * Get Colorado case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Colorado county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court, ${countyName} County, Colorado`;
  }

  /**
   * Generate Colorado header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF COLORADO';
  }

  /**
   * Generate Colorado venue — title case
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Generate Colorado title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Colorado
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Decree is entered by the Court';
  }

  /**
   * Generate Colorado appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This matter came before the Court for hearing.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Petitioner, ${divorceData.petitionerName || '[PETITIONER NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se (self-represented)'}.\n\n`;
      text += `Co-Petitioner/Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, ${divorceData.respondentAppeared ? 'appeared and announced agreement' : 'having been duly served, did not appear'}.`;
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
   * Generate Colorado jurisdiction section — 91-day domicile
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. One of the parties has been domiciled in Colorado for at least ninety-one (91) days preceding the filing of the petition. (C.R.S. § 14-10-106) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The marriage is irretrievably broken. At least ninety-one (91) days have elapsed since the date the petition was filed. (C.R.S. § 14-10-106(1))`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Colorado dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DECREE OF DISSOLUTION',
      text: `IT IS ORDERED that the marriage of ${divorceData.petitionerName || '[PETITIONER NAME]'} and ${divorceData.respondentName || '[RESPONDENT NAME]'} is hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Colorado property division — equitable distribution; "marital property"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in C.R.S. § 14-10-113 and orders an equitable division of marital property as follows:',
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
      content: `IT IS ORDERED that each party's separate property (property acquired before the marriage or acquired during the marriage by gift or inheritance) is confirmed to that party.`,
      type: 'order'
    });

    return {
      title: 'DIVISION OF MARITAL PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Colorado child custody section — uses "Parental Responsibilities"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Parental responsibilities section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following allocation of parental responsibilities is in the best interests of the child(ren) pursuant to C.R.S. § 14-10-124:',
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
        content: `IT IS ORDERED that the parties shall share joint decision-making responsibility for the minor child(ren). The primary residential parent is ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'}.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have sole decision-making responsibility and primary residential parenting time with the minor child(ren).`,
        type: 'order'
      });
    }

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'PARENTAL RESPONSIBILITIES',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Colorado parenting time language (replaces "visitation")
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the parenting time schedule shall be as agreed by the parties or, in the absence of agreement, as set forth in the Parenting Plan (JDF 1113) attached hereto and incorporated herein by reference.`;
  }

  /**
   * Generate Colorado child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Colorado Child Support Guidelines, C.R.S. § 14-10-115.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Colorado Child Support Guidelines, C.R.S. § 14-10-115. The parties shall complete a Child Support Worksheet (JDF 1820).`,
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${obligor} shall maintain health insurance coverage for the minor child(ren) if available at a reasonable cost.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Colorado maintenance section — "Maintenance" not "Alimony"
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
        content: `The Court, having considered the factors set forth in C.R.S. § 14-10-114, orders maintenance as follows:`,
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
   * Generate Colorado judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `DONE AND ORDERED this _____ day of _______________, 20___.



_________________________________
DISTRICT COURT JUDGE
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY, COLORADO` : '[COUNTY] COUNTY, COLORADO'}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Colorado-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Colorado Decree of Dissolution of Marriage');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Colorado dissolution decree');
    }

    warnings.push('Ensure 91 days have elapsed from filing or service before entering the decree. (C.R.S. § 14-10-106)');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A completed Parenting Plan (JDF 1113) must be attached when minor children are involved.');
      warnings.push('A completed Child Support Worksheet (JDF 1820) must be attached.');
    }

    return { errors, warnings };
  }
}

module.exports = ColoradoDivorceDecreeTemplate;
