// templates/states/montana/DivorceDecreeTemplate.js
// Montana Decree of Dissolution of Marriage template
// Complies with MCA Title 40 (Family Law)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Montana Decree of Dissolution of Marriage Template
 *
 * Legal References:
 * - MCA §40-4-104 — Dissolution of marriage (residency, grounds)
 * - MCA §40-4-107 — 20-day waiting period from service or response
 * - MCA §40-4-202 — Property disposition (equitable distribution)
 * - MCA §40-4-203 — Maintenance (spousal support)
 * - MCA §40-4-212 — Parenting plan required
 * - MCA §40-4-234 — Parenting plan criteria and best interest
 * - MCA §40-5-209 — Montana Child Support Guidelines
 *
 * Montana-Specific Terms:
 * - "Decree of Dissolution of Marriage" (not Decree of Divorce)
 * - "CAUSE NO." label
 * - "Parenting" — Montana eliminated "custody" and "visitation" in 2005
 * - "Parenting Time" (not visitation)
 * - "Parenting Plan" required in all cases with children
 * - "Maintenance" (not alimony)
 * - Equitable distribution
 * - District Court
 */
class MontanaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'MT';
    this.stateName = 'Montana';
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

  getCaseNumberLabel() {
    return 'CAUSE NO.';
  }

  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Montana ${countyName} County District Court`;
  }

  generateHeader() {
    return 'STATE OF MONTANA';
  }

  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  generateTitle() {
    return this.documentTitle;
  }

  getEffectiveDateText() {
    return 'the date this Decree is entered by the Court';
  }

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

  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. At least one party has been domiciled in Montana for at least ninety (90) days preceding the filing of the petition. (MCA §40-4-104) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The marriage is irretrievably broken. At least twenty (20) days have elapsed since service or the filing of a response. (MCA §40-4-107)`,
      type: 'jurisdiction'
    };
  }

  generateDissolutionSection(divorceData) {
    return {
      title: 'DECREE OF DISSOLUTION',
      text: `IT IS ORDERED, ADJUDGED, AND DECREED that the marriage of ${divorceData.petitionerName || '[PETITIONER NAME]'} and ${divorceData.respondentName || '[RESPONDENT NAME]'} is hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in MCA §40-4-202 and orders the following just and equitable division of property:',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Petitioner'} as that party's sole and separate property:`,
        type: 'order'
      });
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Respondent'} as that party's sole and separate property:`,
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
      title: 'DIVISION OF PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Montana parenting section — uses "parenting" exclusively, NOT "custody" or "visitation"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Parenting section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following parenting plan is in the best interests of the child(ren) pursuant to MCA §40-4-212 and §40-4-234:',
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

    items.push({
      content: `IT IS ORDERED that the parenting plan filed with this Court is adopted. The allocation of parenting time and decision-making authority shall be as set forth in the parenting plan.`,
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
   * Get Montana parenting time language — no "visitation" terminology
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that parenting time shall be as set forth in the parenting plan, or as otherwise agreed by the parties and approved by the Court.`;
  }

  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];
    const obligor = divorceData.childSupportObligor || divorceData.respondentName || 'Respondent';
    const obligee = divorceData.childSupportObligee || divorceData.petitionerName || 'Petitioner';

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Montana Child Support Guidelines, MCA §40-5-209.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Montana Child Support Guidelines, MCA §40-5-209. The parties shall complete a Child Support Guidelines Worksheet.`,
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
   * Generate Montana maintenance section — "Maintenance" not "Alimony"
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
        content: `The Court, having considered the factors set forth in MCA §40-4-203, orders maintenance as follows:`,
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

  generateJudgmentBlock(divorceData) {
    return {
      text: `SO ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY DISTRICT COURT` : '[COUNTY] COUNTY DISTRICT COURT'}
STATE OF MONTANA`,
      type: 'judgment'
    };
  }

  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Montana Decree of Dissolution of Marriage');
    }

    if (!divorceData.caseNumber) {
      errors.push('Cause number is required for Montana dissolution decree');
    }

    warnings.push('Ensure 20 days have elapsed from service or response before entering the decree. (MCA §40-4-107)');
    warnings.push('Montana uses "parenting" terminology exclusively — not "custody" or "visitation".');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A parenting plan is REQUIRED and must be attached per MCA §40-4-212.');
      warnings.push('A completed Child Support Guidelines Worksheet must be attached per MCA §40-5-209.');
    }

    return { errors, warnings };
  }
}

module.exports = MontanaDivorceDecreeTemplate;
