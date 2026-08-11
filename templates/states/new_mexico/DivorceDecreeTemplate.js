// templates/states/new_mexico/DivorceDecreeTemplate.js
// New Mexico Final Decree of Dissolution of Marriage template
// Complies with NMSA §40-4 (Dissolution of Marriage)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * New Mexico Final Decree of Dissolution of Marriage Template
 *
 * Legal References:
 * - NMSA §40-4 — Dissolution of Marriage
 * - NMSA §40-4-5 — Residency (6 months domicile)
 * - NMSA §40-4-1 — Grounds (incompatibility, cruel treatment, adultery, abandonment)
 * - NMSA §40-4-7 — Community property division and spousal support
 * - NMSA §40-4-9 — Child custody (legal and physical custody)
 * - NMSA §40-4-9.1 — Joint custody presumption, parenting plan, timesharing/visitation
 * - NMSA §40-4-11.1 — Child support guidelines (income shares)
 *
 * New Mexico-Specific Terms:
 * - "Final Decree of Dissolution of Marriage" (not Final Decree of Divorce)
 * - "No." case number label
 * - "Legal Custody" / "Physical Custody"
 * - "Timesharing" / "Visitation" (per NMSA §40-4-9.1)
 * - "Spousal Support" (not alimony or maintenance)
 * - Community property — equal 50/50 division
 * - Parenting plan required with joint custody
 * - District Court
 */
class NewMexicoDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'NM';
    this.stateName = 'New Mexico';
    this.documentTitle = 'FINAL DECREE OF DISSOLUTION OF MARRIAGE';

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
   * Get New Mexico case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'No.';
  }

  /**
   * Get default court for New Mexico county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court, County of ${countyName}, State of New Mexico`;
  }

  /**
   * Generate New Mexico header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF NEW MEXICO';
  }

  /**
   * Generate New Mexico venue — uppercase
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `COUNTY OF ${countyName.toUpperCase()}`;
  }

  /**
   * Generate New Mexico title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for New Mexico
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Final Decree is entered by the Court';
  }

  /**
   * Generate New Mexico appearances section
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

    text += `\n\nThe Court, having considered the evidence and applicable law, enters the following Final Decree:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate New Mexico jurisdiction section — 6-month domicile
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. At least one party has been domiciled in the State of New Mexico for at least six (6) months immediately preceding the filing of the petition. (NMSA §40-4-5) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The parties are incompatible. At least thirty (30) days have elapsed since service of process.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate New Mexico dissolution section
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
   * Generate New Mexico property division — community property, equal 50/50 division
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the community property and community debts of the parties pursuant to NMSA §40-4-7 and orders the following equal division:',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following community property is awarded to ${divorceData.petitionerName || 'Petitioner'} as that party's sole and separate property:`,
        type: 'order'
      });
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following community property is awarded to ${divorceData.respondentName || 'Respondent'} as that party's sole and separate property:`,
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

    items.push({
      content: 'IT IS FURTHER ORDERED that each party\'s separate property — property owned before the marriage or acquired during the marriage by gift, bequest, or inheritance — is confirmed to the owning spouse.',
      type: 'order'
    });

    return {
      title: 'DIVISION OF COMMUNITY PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate New Mexico child custody section — "Legal Custody" and "Physical Custody";
   * joint custody presumed (NMSA §40-4-9.1); parenting plan incorporated
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody arrangement is in the best interests of the child(ren) pursuant to NMSA §40-4-9 and NMSA §40-4-9.1:',
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
        content: `IT IS ORDERED that the parties shall share joint legal custody and joint physical custody of the minor child(ren), as joint custody is presumed to be in the best interests of the child(ren) under NMSA §40-4-9.1. ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall be the primary residential parent.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have sole legal and physical custody of the minor child(ren).`,
        type: 'order'
      });
    }

    items.push({
      content: 'IT IS ORDERED that the Parenting Plan filed with this Court is incorporated herein by reference and shall govern timesharing, decision-making authority, and dispute resolution between the parties. (NMSA §40-4-9.1)',
      type: 'order'
    });

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'CUSTODY AND PARENTING PLAN',
      items,
      type: 'custody'
    };
  }

  /**
   * Get New Mexico timesharing/visitation language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Timesharing/visitation language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the non-residential parent shall have timesharing and visitation as set forth in the Parenting Plan, or as otherwise agreed by the parties and approved by the Court. (NMSA §40-4-9.1)`;
  }

  /**
   * Generate New Mexico child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the New Mexico Child Support Guidelines, NMSA §40-4-11.1.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the New Mexico Child Support Guidelines, NMSA §40-4-11.1. The parties shall complete a Child Support Worksheet.`,
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
   * Generate New Mexico spousal support section — "Spousal Support" not "Alimony" or "Maintenance"
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
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner';

      items.push({
        content: `The Court, having considered the factors set forth in NMSA §40-4-7, including the duration of the marriage, each party's earning capacity, and the financial circumstances of the parties, orders spousal support as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay spousal support to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
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
   * Generate New Mexico judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    const county = divorceData.county ? divorceData.county.toUpperCase() : '[COUNTY]';
    return {
      text: `SO ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE, DISTRICT COURT
COUNTY OF ${county}, STATE OF NEW MEXICO`,
      type: 'judgment'
    };
  }

  /**
   * Perform New Mexico-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for New Mexico Final Decree of Dissolution of Marriage');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for New Mexico dissolution decree');
    }

    warnings.push('Ensure 30 days have elapsed from service before entering the decree.');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A Parenting Plan must be filed and incorporated into the decree. (NMSA §40-4-9.1)');
      warnings.push('A completed Child Support Worksheet must be attached per NMSA §40-4-11.1.');
    }

    return { errors, warnings };
  }
}

module.exports = NewMexicoDivorceDecreeTemplate;
