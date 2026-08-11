// templates/states/delhi/DivorceDecreeTemplate.js
// Delhi divorce decree template
// Governing Law: Hindu Marriage Act 1955 / Special Marriage Act 1954 / Indian Divorce Act 1869

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Delhi Divorce Decree Template
 *
 * In India, the final order is called a "Decree of Divorce."
 * For mutual consent, the decree is granted at the Second Motion hearing
 * (after the 6-month cooling-off period, unless waived per Amardeep Singh).
 *
 * Court: Family Court (Family Courts Act 1984)
 * Appeal: High Court of Delhi
 * Paper size: A4
 *
 * @class DelhiDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class DelhiDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'IN_DL';
    this.stateName = 'Delhi';
    this.countryCode = 'IN';
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
      margin: '1in',
      paperSize: 'A4'
    };
  }

  getCaseNumberLabel() {
    return 'Case No.';
  }

  getDefaultCourt(county) {
    return 'FAMILY COURT, SAKET, NEW DELHI';
  }

  generateHeader() {
    return 'IN THE FAMILY COURT AT NEW DELHI';
  }

  generateVenue(county) {
    const location = (county || 'NEW DELHI').toUpperCase();
    return `${location}`;
  }

  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n\n` +
      `${caseLabel} ${caseNumber}\n\n` +
      `IN THE MATTER OF:\n\n` +
      `${petitioner}\n` +
      `Petitioner\n\n` +
      `Versus\n\n` +
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

  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there is no matrimonial property to be divided.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the settlement of property between the parties.',
        type: 'finding'
      });

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Petitioner'}:`,
          type: 'order'
        });
        divorceData.petitionerProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Respondent'}:`,
          type: 'order'
        });
        divorceData.respondentProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
        items.push({
          content: 'IT IS ORDERED that each party retains the property currently in their possession, as agreed between the parties or as deemed fit by this Court.',
          type: 'order'
        });
      }
    }

    return { title: 'DIVISION OF PROPERTY', items, type: 'property' };
  }

  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody order is in the best interest and welfare of the child(ren):',
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
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'Petitioner'} and ${divorceData.respondentName || 'Respondent'} shall have joint custody of the child(ren), with the welfare of the child(ren) being the paramount consideration (Hindu Minority and Guardianship Act 1956 / Guardians and Wards Act 1890).`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have sole custody of the child(ren), keeping the welfare of the child(ren) as the paramount consideration.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${divorceData.respondentName || 'Respondent'} shall have visitation rights as agreed by the parties or as determined by this Court.`,
        type: 'order'
      });
    }

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'CUSTODY ORDER', items, type: 'custody' };
  }

  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that both parties shall have reasonable visitation rights, and neither party shall do anything to alienate the child(ren)\'s affection for the other party. The welfare of the child(ren) shall be the paramount consideration in all matters concerning custody and visitation.';
  }

  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED that ${divorceData.childSupportObligor || divorceData.respondentName || 'Respondent'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'Petitioner'} maintenance for the minor child(ren) in the amount of INR ${divorceData.childSupportAmount} per month, under Section 26 of the Hindu Marriage Act 1955 / BNSS s.144.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED that the Respondent shall pay maintenance for the minor child(ren) in an amount as this Court deems fit, under Section 26 of the Hindu Marriage Act 1955 / BNSS s.144.',
        type: 'order'
      });
    }

    items.push({
      content: 'IT IS ORDERED that the maintenance shall include provisions for the education, medical expenses, and general welfare of the child(ren).',
      type: 'order'
    });

    return { title: 'CHILD MAINTENANCE', items, type: 'child_support' };
  }

  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that neither party shall claim permanent alimony or maintenance from the other party.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({
        content: `IT IS ORDERED under Section 25 of the Hindu Marriage Act 1955 that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent'} shall pay permanent alimony / maintenance to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner'} in the amount of INR ${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return { title: 'PERMANENT ALIMONY / MAINTENANCE', items, type: 'spousal_support' };
  }

  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS HEREBY ORDERED AND DECREED that the marriage between the Petitioner and the Respondent stands dissolved by a decree of divorce.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that all relief not expressly granted herein is dismissed.',
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

  getEffectiveDateText() {
    return 'This Decree of Divorce takes effect from the date it is passed by this Court. For mutual consent divorce, the decree is granted at the Second Motion hearing after the expiry of the cooling-off period (HMA s.13B(2)).';
  }

  getCertificateNote() {
    return 'A certified copy of this Decree may be obtained from the court registry. Either party may apply for the same after the decree is passed.';
  }
}

module.exports = DelhiDivorceDecreeTemplate;
