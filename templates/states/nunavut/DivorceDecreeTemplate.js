// templates/states/nunavut/DivorceDecreeTemplate.js
// Nunavut divorce order template
// Governing Law: Divorce Act (RSC 1985, c. 3); Family Law Act (SNu 2012, c. 30)

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

/**
 * Nunavut Divorce Order Template
 *
 * In Nunavut, the final divorce document is called a "Divorce Order" issued by the
 * Nunavut Court of Justice. The Nunavut Court of Justice is unique in Canada — it is
 * the only single-level trial court in the country, combining the jurisdiction of a
 * superior court and a territorial court. Created under the Nunavut Act (SC 1993, c. 28).
 *
 * The Divorce Order becomes effective 31 days after it is made (Divorce Act, s.12(1))
 * unless both spouses waive that period or the court reduces it.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3
 *   - s.10: Duty of court — consider reconciliation and reasonable arrangements for children
 *   - s.11: Duty of court — satisfy itself that corollary relief arrangements are reasonable
 *   - s.12(1): Effective date — 31 days after judgment unless varied
 *   - s.12(2): Spouses may jointly request reduction of the waiting period
 *   - s.12(7): Certificate of Divorce — issued by court registrar after effective date
 * - Family Law Act, SNu 2012, c. 30 (property division)
 *
 * @class NunavutDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class NunavutDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'NU';
    this.stateName = 'Nunavut';
    this.countryCode = 'CA';
    this.documentTitle = 'DIVORCE ORDER';

    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'caseNumber',
      'marriageDate'
    ];

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  getCaseNumberLabel() {
    return 'FILE NO.';
  }

  getDefaultCourt() {
    return 'NUNAVUT COURT OF JUSTICE';
  }

  /**
   * Nunavut document header — territory designation.
   * @returns {string} Header text
   */
  generateHeader() {
    return 'NUNAVUT';
  }

  /**
   * Nunavut venue — no counties. The court circuit sits in various communities.
   * Default is Iqaluit.
   * @param {string} county - Community name (optional)
   * @returns {string} Venue text
   */
  generateVenue(county) {
    if (county) {
      return `${county.toUpperCase()}`;
    }
    return 'IQALUIT';
  }

  /**
   * Nunavut case caption uses Applicant/Respondent labels.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt()).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n\n` +
      `${caseLabel} ${caseNumber}\n\n` +
      `IN THE MATTER OF THE DIVORCE ACT, RSC 1985, c. 3\n\n` +
      `BETWEEN:\n\n` +
      `${applicant}\n` +
      `Applicant\n\n` +
      `— and —\n\n` +
      `${respondent}\n` +
      `Respondent`
    );

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted
    };
  }

  /**
   * Nunavut property division under the Family Law Act, SNu 2012, c. 30.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there is no family property to be divided under the Family Law Act, SNu 2012, c. 30.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the division of family property pursuant to the Family Law Act, SNu 2012, c. 30.',
        type: 'finding'
      });

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Applicant'} as that party's separate property:`,
          type: 'order'
        });
        divorceData.petitionerProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Respondent'} as that party's separate property:`,
          type: 'order'
        });
        divorceData.respondentProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
        items.push({
          content: 'IT IS ORDERED that each party retains the personal property currently in that party\'s possession, subject to division under the Family Law Act, SNu 2012, c. 30.',
          type: 'order'
        });
      }
    }

    return { title: 'DIVISION OF FAMILY PROPERTY', items, type: 'property' };
  }

  /**
   * Nunavut child parenting order uses 2021 Divorce Act terminology:
   * "decision-making responsibility" (s.16.1) replaces "custody";
   * "parenting time" (s.16.1) replaces "access".
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child parenting section or null if no children
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following parenting order is in the best interests of the child(ren) (Divorce Act, s.16):',
      type: 'finding'
    });

    items.push({ content: 'The child(ren) subject to this order:', type: 'order' });

    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '[BIRTH DATE]'}`;
      items.push({ content: `${index + 1}. ${childInfo}`, type: 'child_item' });
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
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'Applicant'} and ${divorceData.respondentName || 'Respondent'} shall have shared decision-making responsibility for the child(ren) pursuant to the Divorce Act, RSC 1985, c. 3, s.16.1.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${divorceData.primaryCustodian || divorceData.petitionerName || 'Applicant'}, who shall have primary parenting time.`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'Applicant')
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || 'Respondent')
            : (divorceData.primaryCustodian || divorceData.petitionerName || 'Applicant');
      const otherParentName =
        custody.kind === 'sole_respondent'
          ? (divorceData.petitionerName || 'Applicant')
          : (divorceData.respondentName || 'Respondent');
      soleCustodianName = custodianName;
      items.push({
        content: `IT IS ORDERED that ${custodianName} shall have sole decision-making responsibility for the child(ren) pursuant to the Divorce Act, RSC 1985, c. 3, s.16.1.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${otherParentName} shall have parenting time with the child(ren) as agreed by the parties or as set out in a parenting schedule attached to this Order.`,
        type: 'order'
      });
    } else {
      // Unrecognized/undecided arrangement — neutral order with an explicit
      // placeholder for the parties' actual agreement. Never default to sole.
      items.push({
        content: 'IT IS ORDERED that the parties shall exercise decision-making responsibility for the child(ren) as agreed by the parties: [ARRANGEMENT — set out the parties\' decision-making agreement] (Divorce Act, RSC 1985, c. 3, s.16.1).',
        type: 'order'
      });
    }

    // Primary residence: ordered whenever the case data says where the
    // child(ren) live, regardless of the custody branch. (The joint branch
    // keeps its historical wording and fallbacks unchanged.)
    if (custody.kind !== 'joint' && residenceName && residenceName !== soleCustodianName) {
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}, who shall have primary parenting time.`,
        type: 'order'
      });
    }

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'PARENTING ORDER', items, type: 'custody' };
  }

  /**
   * Nunavut parenting time language — uses Divorce Act 2021 terminology.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that each party shall have parenting time with the child(ren) as agreed in writing by the parties, or, failing agreement, as set out in a parenting schedule filed with this Court. Neither party shall do anything to alienate the child(ren)\'s affection for the other party (Divorce Act, s.16.3).';
  }

  /**
   * Nunavut child support order pursuant to Divorce Act s.15.1 and the Federal
   * Child Support Guidelines, SOR/97-175.
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child support section or null if no children
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED pursuant to s.15.1 of the Divorce Act, RSC 1985, c. 3, and the Federal Child Support Guidelines, SOR/97-175, that ${divorceData.childSupportObligor || divorceData.respondentName || 'Respondent'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'Applicant'} child support in the amount of $${divorceData.childSupportAmount} per month.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED pursuant to s.15.1 of the Divorce Act, RSC 1985, c. 3, that child support shall be paid in accordance with the Federal Child Support Guidelines, SOR/97-175.',
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || 'the support payor'} shall maintain health and dental coverage for the minor child(ren) where available at a reasonable cost through an employer or group plan.`,
      type: 'order'
    });

    return { title: 'CHILD SUPPORT', items, type: 'child_support' };
  }

  /**
   * Nunavut spousal support order pursuant to Divorce Act s.15.2.
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Spousal support section or null if not applicable
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party waives and releases any claim for spousal support from the other party under s.15.2 of the Divorce Act, RSC 1985, c. 3, now and in the future.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({
        content: `IT IS ORDERED pursuant to s.15.2 of the Divorce Act, RSC 1985, c. 3, that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent'} shall pay spousal support to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'Applicant'} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return { title: 'SPOUSAL SUPPORT', items, type: 'spousal_support' };
  }

  /**
   * Nunavut final orders section.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that all corollary relief requested in this proceeding and not expressly granted is dismissed.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that this Divorce Order constitutes the final order in this proceeding and disposes of all matters between the parties.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute and deliver such further documents and do such further acts as may be necessary to give effect to the terms of this Order.',
      type: 'order'
    });

    items.push({
      content: this.getEffectiveDateText(),
      type: 'order'
    });

    items.push({
      content: this.getCertificateNote(),
      type: 'order'
    });

    return { title: 'FINAL ORDERS', items, type: 'final_orders' };
  }

  /**
   * Nunavut divorce effective date: 31 days after the order is made (Divorce Act s.12(1)).
   */
  getEffectiveDateText() {
    return 'This Divorce Order takes effect on the 31st day after it is made, unless appealed or the effective date is varied by order (Divorce Act, s.12(1)).';
  }

  /**
   * Certificate of Divorce issued by the court registrar after the effective date.
   */
  getCertificateNote() {
    return 'A Certificate of Divorce may be obtained from the court office after the effective date of this Order, upon application by either party (Divorce Act, s.12(7)).';
  }

  /**
   * Nunavut judgment block — NUNAVUT COURT OF JUSTICE.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      courtName: 'NUNAVUT COURT OF JUSTICE',
      judgeName: divorceData.judgeName || '________________________',
      date: divorceData.orderDate || '________________________',
      formatted: (
        `DATED at Iqaluit, Nunavut, this _____ day of _________________, _______.\n\n` +
        `________________________________\n` +
        `Judge of the Nunavut Court of Justice`
      )
    };
  }
}

module.exports = NunavutDivorceDecreeTemplate;
