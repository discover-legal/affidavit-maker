// templates/states/tennessee/DivorceDecreeTemplate.js
// Tennessee Final Decree of Divorce template
// Complies with TCA Title 36 (Domestic Relations)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Tennessee Final Decree of Divorce Template
 *
 * Legal References:
 * - TCA 36-4-101 — Grounds for divorce (fault and no-fault)
 * - TCA 36-4-104 — Residency (6 months state)
 * - TCA 36-4-121 — Equitable division of marital property
 * - TCA 36-5-121 — Alimony (rehabilitative, transitional, in futuro, in solido)
 * - TCA 36-6-402 — Primary residential parent / alternate residential parent
 * - TCA 36-6-404 — Parenting plan requirement
 * - TCA 36-5-101 — Child support guidelines
 *
 * Tennessee-Specific Terms:
 * - "Final Decree of Divorce" (not Decree of Dissolution)
 * - "CASE NO." label
 * - "Primary Residential Parent" / "Alternate Residential Parent"
 * - "Parenting Plan" (required for all cases with minor children)
 * - "Alimony" (not maintenance or spousal support) — 4 types
 * - Equitable distribution
 * - Circuit Court or Chancery Court
 */
class TennesseeDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'TN';
    this.stateName = 'Tennessee';
    this.documentTitle = 'FINAL DECREE OF DIVORCE';

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
   * Get Tennessee case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Tennessee county — Circuit or Chancery Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Circuit Court for ${countyName} County, Tennessee`;
  }

  /**
   * Generate Tennessee header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF TENNESSEE';
  }

  /**
   * Generate Tennessee venue — title case
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Generate Tennessee title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Tennessee
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Decree is entered by the Court';
  }

  /**
   * Generate Tennessee appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This cause came to be heard before the Court.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Plaintiff, ${divorceData.petitionerName || '[PLAINTIFF NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se (self-represented)'}.\n\n`;
      text += `Defendant, ${divorceData.respondentName || '[DEFENDANT NAME]'}, ${divorceData.respondentAppeared ? 'appeared and announced agreement' : 'having been duly served, did not appear'}.`;
    } else {
      text += `Plaintiff appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se'}.\n\n`;
      text += `Defendant ${divorceData.respondentAppeared ? 'appeared' : 'did not appear'}.`;
    }

    text += `\n\nThe Court, having heard the evidence, reviewed the pleadings, and being sufficiently advised, enters the following Decree:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Tennessee jurisdiction section — 6-month state residency
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    const hasChildren = divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0);
    const waitingDays = hasChildren ? 'ninety (90)' : 'sixty (60)';

    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. At least one spouse has been a bona fide resident of Tennessee for at least six (6) months preceding the filing. (TCA 36-4-104) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. At least ${waitingDays} days have elapsed since the date the complaint/petition was filed. (TCA 36-4-101(b))`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Tennessee divorce section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Divorce section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DECREE OF DIVORCE',
      text: `IT IS ORDERED, ADJUDGED, AND DECREED that the bonds of matrimony between ${divorceData.petitionerName || '[PLAINTIFF NAME]'} and ${divorceData.respondentName || '[DEFENDANT NAME]'} are hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Tennessee property division — equitable distribution of marital property
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in TCA 36-4-121 and orders an equitable division of marital property as follows:',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following marital property is awarded to ${divorceData.petitionerName || 'Plaintiff'} as that party's sole and separate property:`,
        type: 'order'
      });
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following marital property is awarded to ${divorceData.respondentName || 'Defendant'} as that party's sole and separate property:`,
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
      content: `IT IS ORDERED that each party's separate property (property acquired before the marriage, by gift or inheritance during the marriage, or pain and suffering awards) is confirmed to that party.`,
      type: 'order'
    });

    return {
      title: 'DIVISION OF MARITAL PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Tennessee child custody section — "Primary Residential Parent" / "Alternate Residential Parent"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following parenting arrangement is in the best interests of the child(ren) pursuant to TCA 36-6-106:',
      type: 'finding'
    });

    items.push({
      content: 'The minor child(ren) of this marriage:',
      type: 'order'
    });

    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '[BIRTH DATE]'}`;
      items.push({
        content: `${index + 1}. ${childInfo}`,
        type: 'child_item'
      });
    });

    const primaryParent = divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff';

    items.push({
      content: `IT IS ORDERED that ${primaryParent} is designated as the Primary Residential Parent. The other parent is designated as the Alternate Residential Parent. (TCA 36-6-402)`,
      type: 'order'
    });

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'PARENTING',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Tennessee parenting plan language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting plan language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the Permanent Parenting Plan attached hereto and incorporated herein by reference is approved and shall govern the residential schedule, decision-making authority, and other parenting matters. (TCA 36-6-404)`;
  }

  /**
   * Generate Tennessee child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Tennessee Child Support Guidelines, TCA 36-5-101.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Tennessee Child Support Guidelines, TCA 36-5-101. The parties shall complete a Child Support Worksheet.`,
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
   * Generate Tennessee alimony section — "Alimony" (4 types)
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
        content: 'IT IS ORDERED that each party waives and relinquishes any claim for alimony from the other party, now and forever.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Plaintiff';
      const alimonyType = divorceData.alimonyType || 'rehabilitative';

      items.push({
        content: `The Court, having considered the factors set forth in TCA 36-5-121, orders ${alimonyType} alimony as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay ${alimonyType} alimony to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
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
   * Generate Tennessee judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `IT IS SO ORDERED, ADJUDGED, AND DECREED this _____ day of _______________, 20___.



_________________________________
JUDGE
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY, TENNESSEE` : '[COUNTY] COUNTY, TENNESSEE'}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Tennessee-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Tennessee Final Decree of Divorce');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Tennessee divorce decree');
    }

    const hasChildren = divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0);
    if (hasChildren) {
      warnings.push('Ensure 90 days have elapsed from filing before entering the decree (minor children). (TCA 36-4-101(b))');
    } else {
      warnings.push('Ensure 60 days have elapsed from filing before entering the decree (no minor children). (TCA 36-4-101(b))');
    }

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (hasChildren) {
      warnings.push('A completed Permanent Parenting Plan (TCA 36-6-404) must be attached when minor children are involved.');
      warnings.push('A completed Child Support Worksheet must be attached per TCA 36-5-101.');
    }

    return { errors, warnings };
  }
}

module.exports = TennesseeDivorceDecreeTemplate;
