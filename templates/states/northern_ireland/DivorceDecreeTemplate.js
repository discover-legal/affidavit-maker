// templates/states/northern_ireland/DivorceDecreeTemplate.js
// Northern Ireland Decree Absolute template
// Governing Law: Matrimonial Causes (Northern Ireland) Order 1978

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Northern Ireland Decree Absolute Template
 *
 * NI retains the "Decree Nisi" / "Decree Absolute" terminology (unlike England
 * which moved to Conditional Order / Final Order in 2022).
 *
 * Process:
 * 1. Petition filed
 * 2. Respondent served (personal service or substituted service)
 * 3. If undefended: Petitioner files affidavit in support
 * 4. Decree Nisi granted
 * 5. 6-week waiting period
 * 6. Petitioner applies for Decree Absolute
 * 7. If Petitioner does not apply within 3 months after the 6-week period,
 *    the Respondent may apply
 *
 * Key Legal References:
 * - Matrimonial Causes (Northern Ireland) Order 1978 (SI 1978/1045)
 * - Children (Northern Ireland) Order 1995 — residence and contact orders
 * - Family Proceedings Rules (NI) 1996
 *
 * @class NorthernIrelandDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class NorthernIrelandDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'NIR';
    this.stateName = 'Northern Ireland';
    this.countryCode = 'UK';
    this.documentTitle = 'DECREE ABSOLUTE';

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
    return 'Ref. No.';
  }

  getDefaultCourt(county) {
    return 'HIGH COURT OF JUSTICE IN NORTHERN IRELAND (FAMILY DIVISION)';
  }

  /**
   * NI header.
   */
  generateHeader() {
    return 'IN NORTHERN IRELAND';
  }

  /**
   * NI venue.
   */
  generateVenue(county) {
    const location = (county || '[COURT LOCATION]').toUpperCase();
    return `${location}`;
  }

  /**
   * NI case caption uses Petitioner/Respondent labels.
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[REFERENCE NUMBER]';
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n\n` +
      `${caseLabel} ${caseNumber}\n\n` +
      `DECREE ABSOLUTE\n\n` +
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
   * NI property division — ancillary relief under the 1978 Order.
   * NI follows broadly similar principles to England's s.25 factors
   * (the 1978 Order's ancillary relief provisions mirror MCA 1973).
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there are no ancillary relief orders to be made.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the financial position of the parties having regard to all the circumstances of the case and in particular the matters set out in Article 27 of the Matrimonial Causes (Northern Ireland) Order 1978.',
        type: 'finding'
      });

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is transferred to ${divorceData.petitionerName || 'the Petitioner'}:`,
          type: 'order'
        });
        divorceData.petitionerProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is transferred to ${divorceData.respondentName || 'the Respondent'}:`,
          type: 'order'
        });
        divorceData.respondentProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.lumpSum) {
        items.push({
          content: `IT IS ORDERED that ${divorceData.lumpSumPayor || divorceData.respondentName || 'the Respondent'} shall pay a lump sum of £${divorceData.lumpSum} to ${divorceData.lumpSumPayee || divorceData.petitionerName || 'the Petitioner'} pursuant to Article 25(1)(c) of the Matrimonial Causes (Northern Ireland) Order 1978.`,
          type: 'order'
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty && !divorceData.lumpSum) {
        items.push({
          content: 'IT IS ORDERED that each party shall retain the property currently in that party\'s possession, subject to any ancillary relief order made by this Court.',
          type: 'order'
        });
      }
    }

    return { title: 'ANCILLARY RELIEF', items, type: 'property' };
  }

  /**
   * NI child custody — "residence" and "contact" orders under
   * Children (Northern Ireland) Order 1995, Article 8.
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court, treating the welfare of the child(ren) as its paramount consideration (Children (Northern Ireland) Order 1995, Article 3(1)), and having had regard to the welfare checklist (Article 3(3)), makes the following order:',
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
        content: `IT IS ORDERED that a shared residence order be made in respect of the child(ren), such that the child(ren) shall reside with both ${divorceData.petitionerName || 'the Petitioner'} and ${divorceData.respondentName || 'the Respondent'} in accordance with the arrangements set out below or as agreed.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that a residence order be made in respect of the child(ren), such that the child(ren) shall reside with ${divorceData.primaryCustodian || divorceData.petitionerName || 'the Petitioner'}.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that a contact order be made, such that ${divorceData.respondentName || 'the Respondent'} shall have contact with the child(ren) as agreed between the parties or as set out in a schedule attached to this order.`,
        type: 'order'
      });
    }

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'RESIDENCE AND CONTACT', items, type: 'custody' };
  }

  /**
   * NI contact language.
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that each party shall facilitate the child(ren)\'s relationship with the other parent and shall not act in any way that would undermine the child(ren)\'s relationship with the other parent. Both parties shall cooperate in making arrangements for the welfare of the child(ren).';
  }

  /**
   * NI child maintenance — CMS or court order.
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED that ${divorceData.childSupportObligor || divorceData.respondentName || 'the Respondent'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'the Petitioner'} child maintenance in the amount of £${divorceData.childSupportAmount} per month.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED that child maintenance shall be paid in accordance with the Child Maintenance Service calculation or as privately agreed between the parties.',
        type: 'order'
      });
    }

    return { title: 'CHILD MAINTENANCE', items, type: 'child_support' };
  }

  /**
   * NI spousal maintenance — periodical payments under the 1978 Order, Art.25.
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that neither party shall be entitled to claim periodical payments or a lump sum from the other party under the Matrimonial Causes (Northern Ireland) Order 1978, and all such claims are dismissed.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({
        content: `IT IS ORDERED pursuant to Article 25 of the Matrimonial Causes (Northern Ireland) Order 1978 that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'the Respondent'} shall pay periodical payments (maintenance) to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'the Petitioner'} in the amount of £${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return { title: 'PERIODICAL PAYMENTS (MAINTENANCE)', items, type: 'spousal_support' };
  }

  /**
   * NI final orders section.
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS DECREED that the marriage between the parties solemnised on ' +
        `${divorceData.marriageDate || '[DATE]'} be and is hereby dissolved, the Decree ` +
        'Absolute having been made pursuant to the Matrimonial Causes (Northern Ireland) Order 1978.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that all claims for ancillary relief not expressly dealt with in this order are dismissed.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute and deliver such further documents and do such further acts as may be necessary to give effect to the terms of this order.',
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
   * NI divorce effective date — Decree Absolute takes effect immediately.
   * The 6-week waiting period is between Decree Nisi and Decree Absolute.
   */
  getEffectiveDateText() {
    return 'This Decree Absolute takes effect on the date it is granted. The Decree Nisi was granted on [DATE] and the required 6-week waiting period has elapsed.';
  }

  /**
   * NI — sealed copy of Decree Absolute serves as proof.
   */
  getCertificateNote() {
    return 'A sealed copy of this Decree Absolute may be obtained from the court office. It serves as proof that the marriage has been dissolved.';
  }
}

module.exports = NorthernIrelandDivorceDecreeTemplate;
