// templates/states/south_africa/DivorceDecreeTemplate.js
// South Africa divorce decree template
// Governing Law: Divorce Act 70 of 1979; Matrimonial Property Act 88 of 1984

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * South Africa Divorce Decree Template
 *
 * In South Africa, the final divorce order is called a "Decree of Divorce".
 * It is issued by the High Court. In undefended cases, the Plaintiff applies
 * for default judgment (if the Defendant fails to file a Notice of Intention
 * to Defend within 10 days of service).
 *
 * The Decree of Divorce takes effect immediately upon being granted.
 * There is no statutory waiting period after the decree.
 *
 * Key Legal References:
 * - Divorce Act 70 of 1979
 *   - s.4(1): Irretrievable breakdown of the marriage
 *   - s.6: Safeguards re children — court must be satisfied
 *   - s.7: Division of assets, maintenance, forfeiture of patrimonial benefits
 *   - s.7(3)-(6): Redistribution order (for out-of-community marriages)
 * - Matrimonial Property Act 88 of 1984 (property regimes)
 * - Children's Act 38 of 2005 (parental responsibilities and rights)
 * - Maintenance Act 99 of 1998 (spousal and child maintenance)
 * - Recognition of Customary Marriages Act 120 of 1998 (customary marriages)
 *
 * @class SouthAfricaDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class SouthAfricaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'ZA';
    this.stateName = 'South Africa';
    this.countryCode = 'ZA';
    this.documentTitle = 'DECREE OF DIVORCE';

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
      margin: '2.54cm',
      paperSize: 'A4'
    };
  }

  getCaseNumberLabel() {
    return 'Case No.';
  }

  getDefaultCourt(county) {
    const division = (county || '[DIVISION]').toUpperCase();
    return `HIGH COURT OF SOUTH AFRICA (${division})`;
  }

  /**
   * South Africa document header.
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE HIGH COURT OF SOUTH AFRICA';
  }

  /**
   * South Africa venue uses the High Court division.
   * @param {string} county - Division of the High Court
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const division = (county || '[DIVISION]').toUpperCase();
    return `(${division})`;
  }

  /**
   * South Africa case caption uses Plaintiff/Defendant labels.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    const plaintiff = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const defendant = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n\n` +
      `${caseLabel} ${caseNumber}\n\n` +
      `In the matter between:\n\n` +
      `${plaintiff}\n` +
      `Plaintiff\n\n` +
      `and\n\n` +
      `${defendant}\n` +
      `Defendant\n\n` +
      `DECREE OF DIVORCE`
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
   * South Africa property division depends on the matrimonial property regime.
   *
   * Three regimes:
   * 1. In community of property (default post-1984 without ANC) — 50/50 division
   * 2. Out of community with accrual — equalization of accrual
   * 3. Out of community without accrual — each keeps own property
   *
   * For customary marriages (Recognition of Customary Marriages Act 120 of 1998):
   * default is in community of property.
   *
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];
    const regime = (divorceData.propertyRegime || '').toLowerCase();

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds that there is no joint estate or accrual to be divided.',
        type: 'finding'
      });
    } else if (regime.includes('without accrual')) {
      items.push({
        content: 'The Court notes that the parties were married out of community of property without the accrual system. Each party retains the property in his/her own name.',
        type: 'finding'
      });

      if (divorceData.redistributionOrder) {
        items.push({
          content: `IT IS ORDERED in terms of section 7(3) of the Divorce Act 70 of 1979 that ${divorceData.redistributionDetails || 'a redistribution of assets be effected as set out in the Settlement Agreement incorporated herein'}.`,
          type: 'order'
        });
      }
    } else if (regime.includes('accrual')) {
      items.push({
        content: 'The Court has considered the accrual of the parties\' respective estates during the subsistence of the marriage in terms of section 3 of the Matrimonial Property Act 88 of 1984.',
        type: 'finding'
      });

      if (divorceData.accrualAmount) {
        items.push({
          content: `IT IS ORDERED that ${divorceData.accrualPayor || divorceData.respondentName || 'Defendant'} shall pay to ${divorceData.accrualPayee || divorceData.petitionerName || 'Plaintiff'} the sum of R${divorceData.accrualAmount} in respect of the accrual claim, in terms of section 3 of the Matrimonial Property Act 88 of 1984.`,
          type: 'order'
        });
      }
    } else {
      // Default: in community of property (or customary marriage default)
      items.push({
        content: 'The Court has considered the division of the joint estate of the parties, who were married in community of property.',
        type: 'finding'
      });

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following assets from the joint estate are awarded to ${divorceData.petitionerName || 'Plaintiff'}:`,
          type: 'order'
        });
        divorceData.petitionerProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following assets from the joint estate are awarded to ${divorceData.respondentName || 'Defendant'}:`,
          type: 'order'
        });
        divorceData.respondentProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
        items.push({
          content: 'IT IS ORDERED that the joint estate be divided equally between the parties, each party to retain the movable property currently in his/her possession, subject to the terms of any Settlement Agreement incorporated herein.',
          type: 'order'
        });
      }
    }

    // Pension sharing (Divorce Act s.7(7)-(8); Pension Funds Act 24 of 1956)
    if (divorceData.pensionSharing) {
      items.push({
        content: `IT IS ORDERED in terms of section 7(7) of the Divorce Act 70 of 1979, read with the Pension Funds Act 24 of 1956, that the ${divorceData.pensionFundName || '[PENSION FUND NAME]'} shall pay to ${divorceData.pensionBeneficiary || divorceData.petitionerName || 'Plaintiff'} an amount equal to ${divorceData.pensionSharePercentage || '[PERCENTAGE]'}% of the pension interest of ${divorceData.pensionMember || divorceData.respondentName || 'the member spouse'} as at the date of this decree.`,
        type: 'order'
      });
    }

    // Forfeiture of patrimonial benefits (Divorce Act s.9)
    if (divorceData.forfeitureRequested) {
      items.push({
        content: `IT IS ORDERED in terms of section 9(1) of the Divorce Act 70 of 1979 that ${divorceData.forfeitureParty || 'the Defendant'} shall forfeit the patrimonial benefits of the marriage.`,
        type: 'order'
      });
    }

    return { title: 'DIVISION OF PROPERTY', items, type: 'property' };
  }

  /**
   * South Africa child custody section — Children's Act 38 of 2005.
   * Uses "care" (physical custody), "contact" (visitation), and "guardianship".
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child care section or null if no children
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court, having considered the report and recommendation of the Family Advocate in terms of section 4 of the Mediation in Certain Divorce Matters Act 24 of 1987, and having satisfied itself in terms of section 6 of the Divorce Act 70 of 1979 that the following arrangements are in the best interests of the child(ren) (Children\'s Act 38 of 2005, s.7):',
      type: 'finding'
    });

    items.push({ content: 'The minor child(ren) subject to this order:', type: 'order' });

    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate) || '[BIRTH DATE]'}`;
      items.push({ content: `${index + 1}. ${childInfo}`, type: 'child_item' });
    });

    const custodyType = divorceData.custodyType || 'joint';
    if (custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'Plaintiff'} and ${divorceData.respondentName || 'Defendant'} shall have shared guardianship and shared parental responsibilities and rights in terms of the Children's Act 38 of 2005, s.18.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that the child(ren) shall be in the primary care of ${divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff'}, with reasonable contact to ${divorceData.respondentName || 'Defendant'} as agreed between the parties or as set out in the Parenting Plan.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff'} shall have sole care of the minor child(ren) in terms of the Children's Act 38 of 2005.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${divorceData.respondentName || 'Defendant'} shall have reasonable contact with the child(ren) as agreed between the parties or as determined by this Court.`,
        type: 'order'
      });
    }

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'PARENTAL RESPONSIBILITIES AND RIGHTS', items, type: 'custody' };
  }

  /**
   * South Africa contact (visitation) language — Children's Act 38 of 2005.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Contact language
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that neither party shall do anything to alienate the child(ren) from the other parent or undermine the other parent\'s relationship with the child(ren). Both parties shall foster a positive relationship between the child(ren) and the other parent.';
  }

  /**
   * South Africa child maintenance order — Maintenance Act 99 of 1998.
   * No fixed table — based on needs of child and means of both parents.
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child maintenance section or null if no children
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED in terms of the Maintenance Act 99 of 1998 that ${divorceData.childSupportObligor || divorceData.respondentName || 'Defendant'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'Plaintiff'} maintenance in respect of the minor child(ren) in the amount of R${divorceData.childSupportAmount} per month, payable on or before the first day of each month.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED that maintenance in respect of the minor child(ren) shall be paid in accordance with the Maintenance Act 99 of 1998, in an amount proportional to each parent\'s respective means and the reasonable needs of the child(ren).',
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || 'the maintenance-paying parent'} shall maintain medical aid coverage for the minor child(ren) where available, and the parties shall share all unreimbursed medical, dental, and educational expenses in proportion to their respective incomes.`,
      type: 'order'
    });

    return { title: 'CHILD MAINTENANCE', items, type: 'child_support' };
  }

  /**
   * South Africa spousal maintenance — Divorce Act 70 of 1979, s.7(2).
   * Courts favour rehabilitative maintenance (time-limited).
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Spousal maintenance section or null if not applicable
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party waives and renounces any claim for spousal maintenance against the other, now and in the future, in terms of section 7(2) of the Divorce Act 70 of 1979.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({
        content: `IT IS ORDERED in terms of section 7(2) of the Divorce Act 70 of 1979 that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant'} shall pay spousal maintenance to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'Plaintiff'} in the amount of R${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return { title: 'SPOUSAL MAINTENANCE', items, type: 'spousal_support' };
  }

  /**
   * South Africa final orders section.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that the bonds of marriage subsisting between the parties are hereby dissolved.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that the Settlement Agreement entered into between the parties (if any) is made an order of this Court.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute and deliver such further documents and do such further acts as may be necessary to give effect to the terms of this Decree.',
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
   * South Africa divorce effective date — immediate upon granting.
   * No statutory waiting period after the decree.
   */
  getEffectiveDateText() {
    return 'This Decree of Divorce takes effect immediately upon being granted by this Court.';
  }

  /**
   * South Africa — the decree itself is proof of dissolution.
   * No separate "Certificate of Divorce".
   */
  getCertificateNote() {
    return 'A certified copy of this Decree of Divorce may be obtained from the Registrar of this Court. The decree itself constitutes proof of the dissolution of the marriage.';
  }
}

module.exports = SouthAfricaDivorceDecreeTemplate;
