// templates/states/delaware/DivorceDecreeTemplate.js
// Delaware Decree of Divorce template
// Complies with Del. Code tit. 13 (Domestic Relations)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Delaware Decree of Divorce Template
 *
 * Legal References:
 * - Del. Code tit. 13, §1504 — Residency (6 months)
 * - Del. Code tit. 13, §1505 — Grounds (irretrievable breakdown only)
 * - Del. Code tit. 13, §1513 — Property division (equitable distribution)
 * - Del. Code tit. 13, §1512 — Alimony
 * - Del. Code tit. 13, §722 — Legal custody and residential arrangements
 * - Del. Code tit. 13, §727 — Visitation rights
 * - Del. Code tit. 13, §514 — Delaware Child Support Formula (Melson Formula)
 * - Del. Code tit. 10, §921 — Family Court jurisdiction
 *
 * Delaware-Specific Terms:
 * - "Decree of Divorce"
 * - "PETITION NO." label
 * - "Legal Custody" / "Residential Arrangements"
 * - "Visitation"
 * - "Alimony"
 * - Equitable distribution of marital property
 * - Melson Formula for child support (unique to DE)
 * - Family Court
 */
class DelawareDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'DE';
    this.stateName = 'Delaware';
    this.documentTitle = 'DECREE OF DIVORCE';

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
    return 'PETITION NO.';
  }

  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Family Court of the State of Delaware in and for ${countyName} County`;
  }

  generateHeader() {
    return 'STATE OF DELAWARE';
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
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. At least one party has been a bona fide resident of Delaware for at least six (6) months preceding the filing of the petition. (Del. Code tit. 13, §1504) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The marriage is irretrievably broken and reconciliation is improbable. (Del. Code tit. 13, §1505)`,
      type: 'jurisdiction'
    };
  }

  generateDissolutionSection(divorceData) {
    return {
      title: 'DECREE OF DIVORCE',
      text: `IT IS ORDERED, ADJUDGED, AND DECREED that the marriage of ${divorceData.petitionerName || '[PETITIONER NAME]'} and ${divorceData.respondentName || '[RESPONDENT NAME]'} is hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in Del. Code tit. 13, §1513 and orders the following equitable division of marital property:',
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
   * Generate Delaware child custody section — "Legal Custody" and "Residential Arrangements"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody and residential arrangement is in the best interests of the child(ren) pursuant to Del. Code tit. 13, §722:',
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
        content: `IT IS ORDERED that the parties shall share joint legal custody of the minor child(ren). ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have primary residential arrangements.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have sole legal custody and primary residential arrangements for the minor child(ren).`,
        type: 'order'
      });
    }

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'CUSTODY AND RESIDENTIAL ARRANGEMENTS',
      items,
      type: 'custody'
    };
  }

  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the non-custodial parent shall have reasonable and liberal visitation pursuant to Del. Code tit. 13, §727, or as otherwise agreed by the parties and approved by the Court.`;
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Delaware Child Support Formula (Melson Formula), Del. Code tit. 13, §514.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Delaware Child Support Formula (Melson Formula), Del. Code tit. 13, §514. The parties shall complete a Child Support Guidelines Worksheet.`,
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
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner';

      items.push({
        content: `The Court, having considered the factors set forth in Del. Code tit. 13, §1512, orders alimony as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay alimony to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return {
      title: 'ALIMONY',
      items,
      type: 'spousal_support'
    };
  }

  generateJudgmentBlock(divorceData) {
    return {
      text: `SO ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE
FAMILY COURT OF THE STATE OF DELAWARE
${divorceData.county ? `IN AND FOR ${divorceData.county.toUpperCase()} COUNTY` : 'IN AND FOR [COUNTY] COUNTY'}`,
      type: 'judgment'
    };
  }

  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Delaware Decree of Divorce');
    }

    if (!divorceData.caseNumber) {
      errors.push('Petition number is required for Delaware divorce decree');
    }

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('Child support is calculated using the Delaware Melson Formula (Del. Code tit. 13, §514) — NOT the standard income shares model.');
      warnings.push('A completed Child Support Guidelines Worksheet must be attached.');
    }

    return { errors, warnings };
  }
}

module.exports = DelawareDivorceDecreeTemplate;
