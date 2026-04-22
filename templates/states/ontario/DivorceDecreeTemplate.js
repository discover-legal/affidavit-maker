// templates/states/ontario/DivorceDecreeTemplate.js
// Ontario divorce judgment template
// Governing Law: Divorce Act (RSC 1985, c. 3); Family Law Rules, O. Reg. 114/99

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Ontario Divorce Judgment Template
 *
 * In Ontario, the final divorce order is called a "Divorce Order" (not "Decree").
 * It is issued by the Superior Court of Justice. In uncontested cases, it is typically
 * granted on the papers without a hearing (using a Divorce Order Endorsement form).
 *
 * The Divorce Order becomes effective 31 days after it is made (Divorce Act, s.12(1))
 * unless both spouses waive that period or the court reduces it.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3
 *   - s.10: Duty of court — consider possibility of reconciliation, ensure reasonable
 *     arrangements for children
 *   - s.12: Effective date of divorce — 31 days after judgment unless varied
 *   - s.12(7): Certificate of divorce — issued by registrar after effective date
 * - Family Law Act, RSO 1990, c. F.3 (property and spousal support)
 * - Family Law Rules, O. Reg. 114/99 (Form 25A — Divorce Order)
 *
 * @class OntarioDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class OntarioDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'ON';
    this.stateName = 'Ontario';
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

  getCaseNumberLabel() {
    return 'Court File No.';
  }

  getDefaultCourt(county) {
    const city = (county || '[CITY]').toUpperCase();
    return `SUPERIOR COURT OF JUSTICE — ${city}`;
  }

  /**
   * Ontario document header uses "PROVINCE OF ONTARIO" (not "STATE OF").
   * @returns {string} Header text
   */
  generateHeader() {
    return 'PROVINCE OF ONTARIO';
  }

  /**
   * Ontario venue uses judicial district/city, not "COUNTY OF".
   * @param {string} county - City or judicial district
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const location = (county || '[JUDICIAL DISTRICT]').toUpperCase();
    return `${location}`;
  }

  /**
   * Ontario case caption uses Applicant/Respondent labels (Family Law Rules, O. Reg. 114/99).
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
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
   * Ontario property division under the Family Law Act, RSO 1990, c. F.3.
   * Equalization of net family property (NFP): the spouse with the higher NFP
   * pays an equalization payment equal to half the difference (s.5).
   * "Community property" language must not appear — Ontario uses equalization, not community property.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there is no net family property to be equalized under the Family Law Act, RSO 1990, c. F.3.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the equalization of the parties\' net family property pursuant to the Family Law Act, RSO 1990, c. F.3, s.5.',
        type: 'finding'
      });

      if (divorceData.equalizationPayment) {
        items.push({
          content: `IT IS ORDERED that ${divorceData.equalizationPayor || divorceData.respondentName || 'Respondent'} shall pay to ${divorceData.equalizationPayee || divorceData.petitionerName || 'Applicant'} an equalization payment of $${divorceData.equalizationPayment} pursuant to s.5 of the Family Law Act, RSO 1990, c. F.3.`,
          type: 'order'
        });
      }

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Applicant'} as that party's exclusive property:`,
          type: 'order'
        });
        divorceData.petitionerProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Respondent'} as that party's exclusive property:`,
          type: 'order'
        });
        divorceData.respondentProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty && !divorceData.equalizationPayment) {
        items.push({
          content: 'IT IS ORDERED that each party retains the personal property currently in that party\'s possession, subject to any equalization payment required under the Family Law Act, RSO 1990, c. F.3.',
          type: 'order'
        });
      }
    }

    return { title: 'DIVISION OF PROPERTY', items, type: 'property' };
  }

  /**
   * Ontario child custody section uses 2021 Divorce Act terminology:
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
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'Applicant'} and ${divorceData.respondentName || 'Respondent'} shall have shared decision-making responsibility for the child(ren) pursuant to the Divorce Act, RSC 1985, c. 3, s.16.1.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${divorceData.primaryCustodian || divorceData.petitionerName || 'Applicant'}, who shall have primary parenting time.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Applicant'} shall have sole decision-making responsibility for the child(ren) pursuant to the Divorce Act, RSC 1985, c. 3, s.16.1.`,
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
   * Ontario parenting time language — uses Divorce Act 2021 "parenting time", not "access".
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that each party shall have parenting time with the child(ren) as agreed in writing by the parties, or, failing agreement, in accordance with a parenting schedule to be filed with this Court. Neither party shall do anything to alienate the child(ren)\'s affection for the other party (Divorce Act, s.16.3).';
  }

  /**
   * Ontario child support order pursuant to Divorce Act s.15.1 and the Federal
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
   * Ontario spousal support order pursuant to Divorce Act s.15.2 and
   * Spousal Support Advisory Guidelines.
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
   * Ontario final orders section — avoids US "decree" and "final judgment" language.
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
   * Ontario divorce effective date: 31 days after judgment (Divorce Act s.12(1)).
   * Parties may waive this period by written agreement (s.12(2)).
   */
  getEffectiveDateText() {
    return 'This Divorce Order takes effect on the 31st day after it is made, unless appealed or the effective date is varied by order (Divorce Act, s.12(1)).';
  }

  /**
   * Ontario uses "Certificate of Divorce" issued by the court registrar
   * after the effective date (Divorce Act, s.12(7)).
   */
  getCertificateNote() {
    return 'A Certificate of Divorce may be obtained from the court office after the effective date of this Order, upon application by either party (Divorce Act, s.12(7)).';
  }
}

module.exports = OntarioDivorceDecreeTemplate;
