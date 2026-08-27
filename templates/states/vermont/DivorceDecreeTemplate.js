// templates/states/vermont/DivorceDecreeTemplate.js
// Vermont Final Divorce Order template
// Complies with 15 V.S.A. § 551 et seq.

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');
const { asList } = require('../../core/dataShapes');

/**
 * Vermont Final Divorce Order Template
 *
 * Legal References:
 * - 15 V.S.A. § 551 — Grounds for divorce (no-fault: lived apart 6 months or irretrievable breakdown)
 * - 15 V.S.A. § 592 — Residency requirement (6 months)
 * - 15 V.S.A. § 665 — Legal Responsibility, Physical Responsibility, Parent-Child Contact
 * - 15 V.S.A. § 656 — Child support guidelines (income shares model)
 * - 15 V.S.A. § 751 — Property disposition (equitable distribution)
 * - 15 V.S.A. § 752 — Maintenance
 * - 4 V.S.A. § 31 — Family Division of the Superior Court
 *
 * Vermont-Specific Terms:
 * - "Final Divorce Order" (not Final Decree of Divorce)
 * - "DOCKET NO." label
 * - "Legal Responsibility" / "Physical Responsibility" (not custody)
 * - "Parent-Child Contact" (not visitation)
 * - "Maintenance" (not alimony or spousal support)
 * - Equitable distribution (NOT community property)
 * - Family Division of the Superior Court
 */
class VermontDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'VT';
    this.stateName = 'Vermont';
    this.documentTitle = 'FINAL DIVORCE ORDER';

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
   * Get Vermont case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'DOCKET NO.';
  }

  /**
   * Get default court for Vermont county — Family Division of the Superior Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Family Division of the Superior Court, ${countyName} Unit`;
  }

  /**
   * Generate Vermont header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF VERMONT';
  }

  /**
   * Generate Vermont venue — "[County] Unit"
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `${countyFormatted} Unit`;
  }

  /**
   * Generate Vermont title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Vermont
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Final Divorce Order is entered by the Court';
  }

  /**
   * Generate Vermont appearances section
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

    text += `\n\nThe Court, having considered the evidence and applicable law, enters the following Final Divorce Order:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Vermont jurisdiction section — 6-month residency
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. One of the parties has resided in Vermont for at least six (6) months preceding the filing of the Complaint for Divorce. (15 V.S.A. § 592) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The marriage is irretrievably broken. (15 V.S.A. § 551)`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Vermont dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'FINAL DIVORCE ORDER',
      text: `IT IS ORDERED that the marriage of ${divorceData.petitionerName || '[PLAINTIFF NAME]'} and ${divorceData.respondentName || '[DEFENDANT NAME]'} is hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Vermont property division — equitable distribution per 15 V.S.A. § 751
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in 15 V.S.A. § 751 and orders an equitable division of marital property as follows:',
      type: 'finding'
    });

    if (asList(divorceData.petitionerProperty).length > 0) {
      items.push({
        content: `IT IS ORDERED that the following marital property is awarded to ${divorceData.petitionerName || 'Plaintiff'} as that party's sole and separate property:`,
        type: 'order'
      });
      asList(divorceData.petitionerProperty).forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (asList(divorceData.respondentProperty).length > 0) {
      items.push({
        content: `IT IS ORDERED that the following marital property is awarded to ${divorceData.respondentName || 'Defendant'} as that party's sole and separate property:`,
        type: 'order'
      });
      asList(divorceData.respondentProperty).forEach(prop => {
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
   * Generate Vermont child section — uses "Legal Responsibility" and "Physical Responsibility"
   * per 15 V.S.A. § 665
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Legal/Physical Responsibility section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following allocation of Legal Responsibility and Physical Responsibility is in the best interests of the child(ren) pursuant to 15 V.S.A. § 665:',
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

    // Safety rule (mirrors the base class): only positively recognized
    // custody values render a joint or sole order. Legacy free text like
    // "joint decision making" maps to the joint branch; anything ambiguous
    // renders neutral as-agreed language with a placeholder — NEVER a sole
    // order (see templates/core/parenting.js).
    const custody = resolveCustodyArrangement(divorceData);
    const residenceName = resolvePrimaryResidenceName(divorceData);
    let soleCustodianName = null;

    if (custody.kind === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall share Legal Responsibility (joint decision-making authority) for the minor child(ren). The primary Physical Responsibility (where the child resides) shall be with ${resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Plaintiff'}.`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'Plaintiff')
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || 'Defendant')
            : (resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Plaintiff');
      soleCustodianName = custodianName;
      items.push({
        content: `IT IS ORDERED that ${custodianName} shall have sole Legal Responsibility and primary Physical Responsibility for the minor child(ren).`,
        type: 'order'
      });
    } else {
      // Unrecognized/undecided arrangement — neutral order with an explicit
      // placeholder for the parties' actual agreement. Never default to sole.
      items.push({
        content: 'IT IS ORDERED that the parties shall exercise legal custody and decision-making responsibility for the minor child(ren) as agreed by the parties: [ARRANGEMENT — set out the parties\' decision-making agreement].',
        type: 'order'
      });
    }

    // Primary residence: ordered whenever the case data says where the
    // child(ren) live, regardless of the custody branch. (The joint branch
    // keeps its historical wording and fallbacks unchanged.)
    if (custody.kind !== 'joint' && residenceName && residenceName !== soleCustodianName) {
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}.`,
        type: 'order'
      });
    }

    items.push({
      content: this.getParentChildContactLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'LEGAL RESPONSIBILITY AND PHYSICAL RESPONSIBILITY',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Vermont Parent-Child Contact language (replaces "visitation")
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parent-Child Contact language
   */
  getParentChildContactLanguage(divorceData) {
    return `IT IS ORDERED that the Parent-Child Contact schedule (time with the non-residential parent) shall be as agreed by the parties or, in the absence of agreement, as set forth in the Parenting Plan attached hereto and incorporated herein by reference. (15 V.S.A. § 665)`;
  }

  /**
   * Generate Vermont child support section per 15 V.S.A. § 656
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Vermont Child Support Guidelines, 15 V.S.A. § 656.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Vermont Child Support Guidelines, 15 V.S.A. § 656. The parties shall complete a Child Support Guideline Worksheet.`,
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
   * Generate Vermont maintenance section — "Maintenance" not "Alimony"
   * per 15 V.S.A. § 752
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
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Plaintiff';

      items.push({
        content: `The Court, having considered the factors set forth in 15 V.S.A. § 752, orders maintenance as follows:`,
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
   * Generate Vermont judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `DONE AND ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE, FAMILY DIVISION OF THE SUPERIOR COURT
${divorceData.county ? `${divorceData.county.toUpperCase()} UNIT, VERMONT` : '[COUNTY] UNIT, VERMONT'}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Vermont-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Vermont Final Divorce Order');
    }

    if (!divorceData.caseNumber) {
      errors.push('Docket number is required for Vermont Final Divorce Order');
    }

    warnings.push('Ensure at least one party resided in Vermont for 6 months before filing. (15 V.S.A. § 592)');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A completed Parenting Plan must be attached when minor children are involved.');
      warnings.push('A completed Child Support Guideline Worksheet must be attached per 15 V.S.A. § 656.');
      warnings.push('Vermont uses "Legal Responsibility" and "Physical Responsibility" instead of custody, and "Parent-Child Contact" instead of visitation. (15 V.S.A. § 665)');
    }

    return { errors, warnings };
  }
}

module.exports = VermontDivorceDecreeTemplate;
