// templates/states/prince_edward_island/DivorceDecreeTemplate.js
// Prince Edward Island divorce order template
// Governing Law: Divorce Act (RSC 1985, c. 3); Matrimonial Property Act, RSPEI 1988, c. M-6

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Prince Edward Island Divorce Order Template
 *
 * In Prince Edward Island, the final divorce order is called a "Divorce Order"
 * (not "Decree Absolute"). It is issued by the Supreme Court of Prince Edward Island
 * (Family Section). In uncontested cases, it is typically granted on the papers without a hearing.
 *
 * The Divorce Order becomes effective 31 days after it is made (Divorce Act, s.12(1))
 * unless both spouses waive that period or the court reduces it.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3
 *   - s.10: Duty of court — consider reconciliation, ensure reasonable arrangements for children
 *   - s.12: Effective date of divorce — 31 days after order unless varied
 *   - s.12(7): Certificate of divorce — issued by registrar after effective date
 * - Matrimonial Property Act, RSPEI 1988, c. M-6 (equal division of matrimonial property)
 * - Family Law Act, RSPEI 1988, c. F-2.1 (spousal and child support)
 * - Alimony Act, RSPEI 1988, c. A-10 (spousal maintenance)
 *
 * @class PEIDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class PEIDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'PE';
    this.stateName = 'Prince Edward Island';
    this.countryCode = 'CA';
    this.documentTitle = 'DIVORCE ORDER';

    try {
      this.metadata = require('./metadata.json');
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

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * PEI uses "Court File No." (not "CASE NO.").
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'Court File No.';
  }

  /**
   * Default court for PEI — Supreme Court of Prince Edward Island (Family Section).
   * @param {string} county - City or location of filing
   * @returns {string} Default court name
   */
  getDefaultCourt(county) {
    return 'SUPREME COURT OF PRINCE EDWARD ISLAND (FAMILY SECTION)';
  }

  /**
   * PEI document header uses "PROVINCE OF PRINCE EDWARD ISLAND" (not "STATE OF").
   * @returns {string} Header text
   */
  generateHeader() {
    return 'PROVINCE OF PRINCE EDWARD ISLAND';
  }

  /**
   * PEI venue — PEI has a single court location; no county subdivision is used.
   * @param {string} county - Location (unused for PEI)
   * @returns {string} Venue text
   */
  generateVenue(county) {
    return 'CHARLOTTETOWN';
  }

  /**
   * PEI case caption uses Petitioner/Respondent labels.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
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
   * PEI property division under the Matrimonial Property Act, RSPEI 1988, c. M-6.
   * Property is subject to equitable distribution.
   * "Community property" language must not appear.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there is no matrimonial property to be divided under the Matrimonial Property Act, RSPEI 1988, c. M-6.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the division of matrimonial property pursuant to the Matrimonial Property Act, RSPEI 1988, c. M-6. Matrimonial property is subject to equitable distribution having regard to the contributions and circumstances of each spouse.',
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
          content: 'IT IS ORDERED that each party retains the personal property currently in that party\'s possession, subject to equitable distribution under the Matrimonial Property Act, RSPEI 1988, c. M-6.',
          type: 'order'
        });
      }
    }

    return { title: 'DIVISION OF MATRIMONIAL PROPERTY', items, type: 'property' };
  }

  /**
   * PEI child parenting order uses 2021 Divorce Act terminology:
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
   * PEI parenting time language — uses Divorce Act 2021 terminology.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that each party shall have parenting time with the child(ren) as agreed in writing by the parties, or, failing agreement, as set out in a parenting schedule filed with this Court. Neither party shall do anything to alienate the child(ren)\'s affection for the other party (Divorce Act, s.16.3).';
  }

  /**
   * PEI child support order pursuant to Divorce Act s.15.1 and the Federal
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
   * PEI spousal support order pursuant to Divorce Act s.15.2.
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
   * PEI final orders section — avoids US "decree" and "final judgment" language.
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
   * PEI divorce effective date: 31 days after order (Divorce Act s.12(1)).
   * Parties may waive this period by written agreement (s.12(2)).
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'This Divorce Order takes effect on the 31st day after it is made, unless appealed or the effective date is varied by order of the Court (Divorce Act, s.12(1)).';
  }

  /**
   * PEI uses "Certificate of Divorce" issued by the court registrar
   * after the effective date (Divorce Act, s.12(7)).
   * @returns {string} Certificate note
   */
  getCertificateNote() {
    return 'A Certificate of Divorce may be obtained from the court office after the effective date of this Order (Divorce Act, s.12(7)).';
  }

  /**
   * PEI dissolution order text.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DIVORCE GRANTED',
      text: `IT IS ORDERED that the marriage solemnized on ${this.formatDate(divorceData.marriageDate) || '[DATE OF MARRIAGE]'} between ${divorceData.petitionerName || '[PETITIONER NAME]'} and ${divorceData.respondentName || '[RESPONDENT NAME]'} is dissolved, and the parties are divorced from each other, effective as set out below.`,
      type: 'dissolution'
    };
  }

  /**
   * PEI judgment block — justice presiding at the Supreme Court (Family Section).
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: (
        `MADE at _____________________, Prince Edward Island,\n` +
        `this _____ day of _________________, _______.\n\n\n` +
        `_________________________________\n` +
        `JUSTICE OF THE SUPREME COURT\n` +
        `OF PRINCE EDWARD ISLAND (FAMILY SECTION)`
      ),
      type: 'judgment'
    };
  }
}

module.exports = PEIDivorceDecreeTemplate;
