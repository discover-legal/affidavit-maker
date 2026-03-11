// templates/states/yukon/DivorceDecreeTemplate.js
// Yukon divorce order template
// Governing Law: Divorce Act (RSC 1985, c. 3); Family Property and Support Act (RSY 2002, c. 83)

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Yukon Divorce Order Template
 *
 * In Yukon, the final divorce document is called a "Divorce Order" issued by the
 * Supreme Court of Yukon. In uncontested cases, it may be granted on the papers
 * without a hearing.
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
 * - Family Property and Support Act, RSY 2002, c. 83 (property division — equal division
 *   of family assets, 50/50 default; spousal support)
 *
 * @class YukonDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class YukonDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'YT';
    this.stateName = 'Yukon';
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
    return 'S.C. NO.';
  }

  getDefaultCourt() {
    return 'SUPREME COURT OF YUKON';
  }

  /**
   * Yukon document header — territory designation.
   * @returns {string} Header text
   */
  generateHeader() {
    return 'YUKON';
  }

  /**
   * Yukon venue — no counties. Supreme Court sits in Whitehorse.
   * @param {string} county - Community name (optional)
   * @returns {string} Venue text
   */
  generateVenue(county) {
    if (county) {
      return `${county.toUpperCase()}`;
    }
    return 'WHITEHORSE';
  }

  /**
   * Yukon case caption uses Petitioner/Respondent labels.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt()).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n\n` +
      `${caseLabel} ${caseNumber}\n\n` +
      `IN THE MATTER OF THE DIVORCE ACT, RSC 1985, c. 3\n\n` +
      `BETWEEN:\n\n` +
      `${petitioner}\n` +
      `Petitioner\n\n` +
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
   * Yukon property division under the Family Property and Support Act, RSY 2002, c. 83.
   * Family assets are subject to equal division (50/50 default).
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there are no family assets to be divided under the Family Property and Support Act, RSY 2002, c. 83.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the division of family assets pursuant to the Family Property and Support Act, RSY 2002, c. 83. Family assets are subject to equal division between the spouses.',
        type: 'finding'
      });

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Petitioner'} as that party's separate property:`,
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
          content: 'IT IS ORDERED that each party retains the personal property currently in that party\'s possession, subject to equal division under the Family Property and Support Act, RSY 2002, c. 83.',
          type: 'order'
        });
      }
    }

    return { title: 'DIVISION OF FAMILY ASSETS', items, type: 'property' };
  }

  /**
   * Yukon child parenting order uses 2021 Divorce Act terminology:
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
        : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate) || '[BIRTH DATE]'}`;
      items.push({ content: `${index + 1}. ${childInfo}`, type: 'child_item' });
    });

    const custodyType = divorceData.custodyType || 'joint';
    if (custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'Petitioner'} and ${divorceData.respondentName || 'Respondent'} shall have shared decision-making responsibility for the child(ren) pursuant to the Divorce Act, RSC 1985, c. 3, s.16.1.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'}, who shall have primary parenting time.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have sole decision-making responsibility for the child(ren) pursuant to the Divorce Act, RSC 1985, c. 3, s.16.1.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${divorceData.respondentName || 'Respondent'} shall have parenting time with the child(ren) as agreed by the parties or as set out in a parenting schedule attached to this Order.`,
        type: 'order'
      });
    }

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'PARENTING ORDER', items, type: 'custody' };
  }

  /**
   * Yukon parenting time language — uses Divorce Act 2021 terminology.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that each party shall have parenting time with the child(ren) as agreed in writing by the parties, or, failing agreement, as set out in a parenting schedule filed with this Court. Neither party shall do anything to alienate the child(ren)\'s affection for the other party (Divorce Act, s.16.3).';
  }

  /**
   * Yukon child support order pursuant to Divorce Act s.15.1 and the Federal
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
        content: `IT IS ORDERED pursuant to s.15.1 of the Divorce Act, RSC 1985, c. 3, and the Federal Child Support Guidelines, SOR/97-175, that ${divorceData.childSupportObligor || divorceData.respondentName || 'Respondent'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'Petitioner'} child support in the amount of $${divorceData.childSupportAmount} per month.`,
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
   * Yukon spousal support order pursuant to Divorce Act s.15.2 and
   * Family Property and Support Act, RSY 2002, c. 83, Part 3.
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
        content: `IT IS ORDERED pursuant to s.15.2 of the Divorce Act, RSC 1985, c. 3, that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent'} shall pay spousal support to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner'} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return { title: 'SPOUSAL SUPPORT', items, type: 'spousal_support' };
  }

  /**
   * Yukon final orders section.
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
   * Yukon divorce effective date: 31 days after the order is made (Divorce Act s.12(1)).
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
}

module.exports = YukonDivorceDecreeTemplate;
