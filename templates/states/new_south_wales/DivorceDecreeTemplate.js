// templates/states/new_south_wales/DivorceDecreeTemplate.js
// New South Wales divorce order template
// Governing Law: Family Law Act 1975 (Cth); Federal Circuit and Family Court of Australia (Family Law) Rules 2021 (Cth)

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * New South Wales Divorce Order Template
 *
 * In Australia, the final divorce document is a "Divorce Order" (not "Decree").
 * It is issued by the Federal Circuit and Family Court of Australia (Division 2).
 *
 * The Divorce Order takes effect 1 month and 1 day after it is made
 * (Family Law Act 1975 (Cth), s.55). The parties may not remarry until
 * the order takes effect.
 *
 * Key Legal References:
 * - Family Law Act 1975 (Cth)
 *   - s.48: Sole ground — irretrievable breakdown
 *   - s.55: Effective date — 1 month and 1 day after order is made
 *   - s.60CA: Best interests of the child — paramount consideration
 *   - s.79: Property settlement — just and equitable division
 *   - ss.72-75: Spousal maintenance
 *
 * @class NewSouthWalesDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class NewSouthWalesDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'NSW';
    this.stateName = 'New South Wales';
    this.countryCode = 'AU';
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
      margin: '2.54cm',
      paperSize: 'A4'
    };
  }

  getCaseNumberLabel() {
    return 'File Number';
  }

  getDefaultCourt(county) {
    const city = (county || '[CITY]').toUpperCase();
    return `FEDERAL CIRCUIT AND FAMILY COURT OF AUSTRALIA (DIVISION 2) — ${city} REGISTRY`;
  }

  generateHeader() {
    return 'STATE OF NEW SOUTH WALES';
  }

  generateVenue(county) {
    const location = (county || '[REGISTRY LOCATION]').toUpperCase();
    return `${location} REGISTRY`;
  }

  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[FILE NUMBER]';
    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n\n` +
      `${caseLabel}: ${caseNumber}\n\n` +
      `IN THE MATTER OF THE FAMILY LAW ACT 1975 (CTH)\n\n` +
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
   * Australian property division — s.79 of the Family Law Act 1975 (Cth).
   * Uses the 4-step process: identify/value, contributions, future needs, just and equitable.
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there is no property to be divided pursuant to section 79 of the Family Law Act 1975 (Cth).',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the division of property pursuant to section 79 of the Family Law Act 1975 (Cth), having regard to the contributions of the parties (s.79(4)) and the factors set out in section 75(2).',
        type: 'finding'
      });

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is to vest in ${divorceData.petitionerName || 'Applicant'}:`,
          type: 'order'
        });
        divorceData.petitionerProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is to vest in ${divorceData.respondentName || 'Respondent'}:`,
          type: 'order'
        });
        divorceData.respondentProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
        items.push({
          content: 'IT IS ORDERED that each party retains the property currently in that party\'s possession, subject to any further property settlement order under section 79 of the Family Law Act 1975 (Cth).',
          type: 'order'
        });
      }
    }

    return { title: 'PROPERTY SETTLEMENT', items, type: 'property' };
  }

  /**
   * Australian parenting orders — Part VII of the Family Law Act 1975 (Cth).
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following parenting orders are in the best interests of the child(ren) (Family Law Act 1975 (Cth), s.60CA):',
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
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'Applicant'} and ${divorceData.respondentName || 'Respondent'} shall have shared parental responsibility for the child(ren) under the Family Law Act 1975 (Cth).`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that the child(ren) shall live with ${divorceData.primaryCustodian || divorceData.petitionerName || 'Applicant'} and spend time with ${divorceData.respondentName || 'Respondent'} as agreed or as set out in a parenting plan.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Applicant'} shall have sole parental responsibility for the child(ren) pursuant to the Family Law Act 1975 (Cth).`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that the child(ren) shall spend time with ${divorceData.respondentName || 'Respondent'} as agreed by the parties or as determined by the Court.`,
        type: 'order'
      });
    }

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'PARENTING ORDERS', items, type: 'custody' };
  }

  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that each party shall facilitate and encourage the child(ren)\'s relationship with the other party. Neither party shall do anything to undermine the child(ren)\'s relationship with the other party (Family Law Act 1975 (Cth), s.60CC).';
  }

  /**
   * Australian child support — Child Support (Assessment) Act 1989 (Cth).
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED that ${divorceData.childSupportObligor || divorceData.respondentName || 'Respondent'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'Applicant'} child support in the amount of $${divorceData.childSupportAmount} per month, or as assessed by Services Australia (Child Support) pursuant to the Child Support (Assessment) Act 1989 (Cth).`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED that child support shall be assessed and collected by Services Australia (Child Support) in accordance with the Child Support (Assessment) Act 1989 (Cth).',
        type: 'order'
      });
    }

    return { title: 'CHILD SUPPORT', items, type: 'child_support' };
  }

  /**
   * Australian spousal maintenance — ss.72-75 of the Family Law Act 1975 (Cth).
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party releases any claim for spousal maintenance from the other party under sections 72-75 of the Family Law Act 1975 (Cth).',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({
        content: `IT IS ORDERED pursuant to section 74 of the Family Law Act 1975 (Cth) that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent'} shall pay spousal maintenance to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'Applicant'} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return { title: 'SPOUSAL MAINTENANCE', items, type: 'spousal_support' };
  }

  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that the marriage between the parties is dissolved.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that all claims for relief not expressly granted herein are dismissed.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute and deliver such further documents as may be necessary to give effect to the terms of this Order.',
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
    return 'This Divorce Order takes effect one month and one day after the date on which it is made, unless it is rescinded (Family Law Act 1975 (Cth), s.55). The parties may not remarry until the order takes effect.';
  }

  getCertificateNote() {
    return 'A sealed copy of this Divorce Order may be obtained from the court registry after the order takes effect and serves as proof that the marriage has been dissolved.';
  }
}

module.exports = NewSouthWalesDivorceDecreeTemplate;
