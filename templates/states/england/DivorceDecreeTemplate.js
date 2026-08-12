// templates/states/england/DivorceDecreeTemplate.js
// England & Wales Final Order template
// Governing Law: Divorce, Dissolution and Separation Act 2020; Matrimonial Causes Act 1973

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * England & Wales Divorce Final Order Template
 *
 * Since April 2022, the final divorce order is called a "Final Order"
 * (previously "Decree Absolute"). The interim order is called a
 * "Conditional Order" (previously "Decree Nisi").
 *
 * Process:
 * 1. Application filed (sole or joint)
 * 2. 20-week reflection period
 * 3. Conditional Order granted
 * 4. 6-week gap
 * 5. Final Order applied for and granted
 *
 * Key Legal References:
 * - Divorce, Dissolution and Separation Act 2020
 * - Matrimonial Causes Act 1973, s.23-25A (financial remedies)
 * - Children Act 1989 (child arrangements)
 * - Family Procedure Rules 2010
 *
 * @class EnglandDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class EnglandDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'ENG';
    this.stateName = 'England & Wales';
    this.countryCode = 'UK';
    this.documentTitle = 'FINAL ORDER';

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
    const location = (county || '[LOCATION]').toUpperCase();
    return `FAMILY COURT AT ${location}`;
  }

  /**
   * England header.
   */
  generateHeader() {
    return 'IN ENGLAND AND WALES';
  }

  /**
   * England venue — court sitting location.
   */
  generateVenue(county) {
    const location = (county || '[COURT LOCATION]').toUpperCase();
    return `${location}`;
  }

  /**
   * England case caption uses Applicant/Respondent labels.
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
      `IN THE MATTER OF THE DIVORCE, DISSOLUTION AND SEPARATION ACT 2020\n\n` +
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
   * England property division — financial remedy under MCA 1973, s.25.
   * England does not have a fixed property division formula; the court
   * exercises discretion based on the s.25 factors. The starting point
   * in long marriages is equal sharing (White v White [2001] 1 AC 596).
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there are no financial remedy orders to be made.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the financial position of the parties having regard to all the circumstances of the case and in particular the matters set out in section 25 of the Matrimonial Causes Act 1973.',
        type: 'finding'
      });

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is transferred to ${divorceData.petitionerName || 'the Applicant'}:`,
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
          content: `IT IS ORDERED that ${divorceData.lumpSumPayor || divorceData.respondentName || 'the Respondent'} shall pay a lump sum of £${divorceData.lumpSum} to ${divorceData.lumpSumPayee || divorceData.petitionerName || 'the Applicant'} pursuant to section 23(1)(c) of the Matrimonial Causes Act 1973.`,
          type: 'order'
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty && !divorceData.lumpSum) {
        items.push({
          content: 'IT IS ORDERED that the financial arrangements between the parties shall be as set out in any consent order filed with the Court, or, in the absence of such an order, each party shall retain the property currently in that party\'s possession.',
          type: 'order'
        });
      }
    }

    return { title: 'FINANCIAL REMEDY', items, type: 'property' };
  }

  /**
   * England child arrangements — Children Act 1989, s.8 orders.
   * "Child arrangements order" replaces former "residence" and "contact" orders.
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court, having considered the welfare of the child(ren) as its paramount consideration (Children Act 1989, s.1), and having had regard to the welfare checklist (s.1(3)), makes the following child arrangements order:',
      type: 'finding'
    });

    items.push({ content: 'The child(ren) subject to this order:', type: 'order' });

    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '[BIRTH DATE]'}`;
      items.push({ content: `${index + 1}. ${childInfo}`, type: 'child_item' });
    });

    const custodyType = divorceData.custodyType || 'joint';
    if (custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED that the child(ren) shall live with both ${divorceData.petitionerName || 'the Applicant'} and ${divorceData.respondentName || 'the Respondent'} in accordance with the arrangements set out below or as agreed between the parties.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that the child(ren) shall live with ${divorceData.primaryCustodian || divorceData.petitionerName || 'the Applicant'}.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${divorceData.respondentName || 'the Respondent'} shall have contact with the child(ren) as agreed between the parties or as set out in a schedule attached to this order.`,
        type: 'order'
      });
    }

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'CHILD ARRANGEMENTS ORDER', items, type: 'custody' };
  }

  /**
   * England contact / "spending time with" language.
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that each party shall facilitate the child(ren)\'s relationship with the other parent and shall not act in any way that would undermine the child(ren)\'s relationship with the other parent. Both parties shall cooperate in making arrangements for the child(ren)\'s welfare.';
  }

  /**
   * England child maintenance — CMS guidelines or court order.
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED that ${divorceData.childSupportObligor || divorceData.respondentName || 'the Respondent'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'the Applicant'} child maintenance in the amount of £${divorceData.childSupportAmount} per month.`,
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
   * England spousal maintenance — MCA 1973, s.23(1)(a).
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that neither party shall be entitled to make any further application for periodical payments or a lump sum order under the Matrimonial Causes Act 1973 (a "clean break" order pursuant to s.25A).',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({
        content: `IT IS ORDERED pursuant to section 23(1)(a) of the Matrimonial Causes Act 1973 that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'the Respondent'} shall pay periodical payments (spousal maintenance) to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'the Applicant'} in the amount of £${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return { title: 'SPOUSAL MAINTENANCE', items, type: 'spousal_support' };
  }

  /**
   * England final orders section.
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that the marriage between the parties solemnised on ' +
        `${divorceData.marriageDate || '[DATE]'} is dissolved, the Final Order having been made ` +
        'pursuant to section 1 of the Matrimonial Causes Act 1973 (as substituted by the Divorce, Dissolution and Separation Act 2020).',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that all claims for financial remedy not expressly dealt with in this order are dismissed.',
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
   * England divorce effective date — Final Order takes effect immediately when made.
   */
  getEffectiveDateText() {
    return 'This Final Order takes effect on the date it is made. The Conditional Order was made on [DATE] and the required 6-week period has elapsed.';
  }

  /**
   * England — a copy of the Final Order serves as proof of dissolution.
   */
  getCertificateNote() {
    return 'A sealed copy of this Final Order may be obtained from the court office. It serves as proof that the marriage has been dissolved.';
  }
}

module.exports = EnglandDivorceDecreeTemplate;
