// templates/states/georgia/DivorceDecreeTemplate.js
// Georgia Final Judgment and Decree of Divorce template
// Complies with O.C.G.A. § 19-5-1 et seq. and Georgia Superior Court rules

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Georgia Final Judgment and Decree of Divorce Template
 *
 * Legal References:
 * - O.C.G.A. § 19-5-1 et seq. — Divorce proceedings
 * - O.C.G.A. § 19-5-8 — Minimum 30-day waiting period from service
 * - O.C.G.A. § 19-6-1 — Alimony authority and standards
 * - O.C.G.A. § 19-7-1 — Child custody — best interests standard
 * - O.C.G.A. § 19-6-15 — Child support guidelines
 *
 * Georgia-Specific Terms:
 * - "Final Judgment and Decree of Divorce"
 * - "CIVIL ACTION FILE NO." case number label
 * - "Alimony" (not maintenance)
 * - "Legal Custody" / "Physical Custody" (not parental responsibilities)
 * - Equitable distribution of marital property
 * - Superior Court
 */
class GeorgiaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'GA';
    this.stateName = 'Georgia';
    this.documentTitle = 'FINAL JUDGMENT AND DECREE OF DIVORCE';

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
   * Get Georgia case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CIVIL ACTION FILE NO.';
  }

  /**
   * Get default court for Georgia county — Superior Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Superior Court of ${countyName} County, Georgia`;
  }

  /**
   * Generate Georgia header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF GEORGIA';
  }

  /**
   * Generate Georgia venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate Georgia case caption — Plaintiff/Defendant style
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    caption += `IN THE ${courtName}\n\n`;

    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `${caseLabel} ${caseNumber}\n\n`;

    const petitioner = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    caption += `${petitioner},\n`;
    caption += `    Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${respondent},\n`;
    caption += `    Defendant.`;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Georgia title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Georgia
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Final Judgment and Decree of Divorce is signed by the Court';
  }

  /**
   * Generate Georgia appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This matter came on for a hearing before the Court.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Plaintiff, ${divorceData.petitionerName || '[PLAINTIFF NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel of record' : 'pro se'}.\n\n`;
      text += `Defendant, ${divorceData.respondentName || '[DEFENDANT NAME]'}, ${divorceData.respondentAppeared ? 'appeared and announced agreement to the terms of this Final Judgment' : 'having been duly served with process, did not appear, and default was duly entered against Defendant'}.`;
    } else {
      text += `Plaintiff, ${divorceData.petitionerName || '[PLAINTIFF NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel of record' : 'pro se'}.\n\n`;
      text += `Defendant, ${divorceData.respondentName || '[DEFENDANT NAME]'}, ${divorceData.respondentAppeared ? 'appeared' : 'although duly served with process, did not appear'}.`;
    }

    text += `\n\nThe Court, having heard evidence and considered the record, enters the following Final Judgment and Decree of Divorce:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Georgia jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'FINDINGS OF FACT',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. Plaintiff has been a bona fide resident of the State of Georgia for more than six (6) months preceding the filing of this action. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The marriage of the parties is irretrievably broken, or other grounds for divorce have been established. At least thirty (30) days have elapsed since service of process on Defendant. (O.C.G.A. § 19-5-8)`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Georgia dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DIVORCE GRANTED',
      text: `IT IS HEREBY ORDERED, ADJUDGED, AND DECREED that a total divorce is granted between ${divorceData.petitionerName || '[PLAINTIFF NAME]'} and ${divorceData.respondentName || '[DEFENDANT NAME]'}, and the bonds of matrimony heretofore existing between the parties are hereby dissolved, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Georgia property division — equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court finds that the following is an equitable division of the marital property of the parties, having considered all relevant factors.',
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
    } else {
      items.push({
        content: `IT IS ORDERED that each party is awarded the personal property currently in that party's possession as their sole and separate property.`,
        type: 'order'
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

    return {
      title: 'DIVISION OF PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Georgia child custody section — uses "Legal Custody"/"Physical Custody"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody and visitation orders are in the best interests of the minor child(ren): (O.C.G.A. § 19-7-1)',
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

    const custodyType = divorceData.custodyType || 'joint';

    if (custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall share joint legal custody of the minor child(ren). The child(ren) shall primarily reside with ${divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff'} as the primary physical custodian.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff'} shall have sole legal and primary physical custody of the minor child(ren).`,
        type: 'order'
      });
    }

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'CUSTODY AND VISITATION',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Georgia visitation language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    const nonCustodian = divorceData.primaryCustodian === divorceData.petitionerName
      ? (divorceData.respondentName || 'Defendant')
      : (divorceData.petitionerName || 'Plaintiff');
    return `IT IS ORDERED that ${nonCustodian} shall have reasonable visitation with the minor child(ren) at times mutually agreed upon by the parties, including but not limited to alternating holidays, spring break, and summer vacation.`;
  }

  /**
   * Generate Georgia child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, due on the first day of each month, calculated in accordance with the Georgia Child Support Guidelines, O.C.G.A. § 19-6-15.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Georgia Child Support Guidelines, O.C.G.A. § 19-6-15. The parties shall complete a Child Support Worksheet.`,
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
   * Generate Georgia spousal support section — "Alimony"
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

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay alimony to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}, pursuant to O.C.G.A. § 19-6-1.`,
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
   * Generate Georgia judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `SO ORDERED, this _____ day of _______________, 20___.



_________________________________
JUDGE, SUPERIOR COURT
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY, GEORGIA` : '[COUNTY] COUNTY, GEORGIA'}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Georgia-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Georgia Final Judgment and Decree of Divorce');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number (Civil Action File No.) is required for Georgia divorce decree');
    }

    warnings.push('Ensure at least 30 days have elapsed since service of process before entry of Final Judgment. (O.C.G.A. § 19-5-8)');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    return { errors, warnings };
  }
}

module.exports = GeorgiaDivorceDecreeTemplate;
