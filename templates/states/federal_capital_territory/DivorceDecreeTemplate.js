// templates/states/federal_capital_territory/DivorceDecreeTemplate.js
// FCT (Abuja) divorce decree template
// Governing Law: Matrimonial Causes Act 1970, Cap M7 LFN 2004

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Federal Capital Territory (Abuja) Divorce Decree Template
 *
 * @class FCTDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class FCTDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'FC';
    this.stateName = 'Federal Capital Territory';
    this.countryCode = 'NG';
    this.documentTitle = 'DECREE NISI';

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

  getCaseNumberLabel() { return 'Suit No.'; }

  getDefaultCourt(county) {
    const division = (county || 'ABUJA').toUpperCase();
    return `HIGH COURT OF THE FEDERAL CAPITAL TERRITORY — ${division} JUDICIAL DIVISION`;
  }

  generateHeader() { return 'IN THE HIGH COURT OF THE FEDERAL CAPITAL TERRITORY'; }

  generateVenue(county) {
    const location = (county || 'ABUJA').toUpperCase();
    return `${location} JUDICIAL DIVISION`;
  }

  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[SUIT NUMBER]';
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n\n` +
      `${caseLabel} ${caseNumber}\n\n` +
      `IN THE MATTER OF THE MATRIMONIAL CAUSES ACT, CAP M7 LFN 2004\n\n` +
      `BETWEEN:\n\n` +
      `${petitioner}\n` +
      `Petitioner\n\n` +
      `— AND —\n\n` +
      `${respondent}\n` +
      `Respondent`
    );

    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted };
  }

  generatePropertyDivisionSection(divorceData) {
    const items = [];
    if (divorceData.hasProperty === false) {
      items.push({ content: 'The Court finds that no ancillary order regarding property is necessary in this matter.', type: 'finding' });
    } else {
      items.push({ content: 'The Court has considered the parties\' submissions regarding property and ancillary matters pursuant to sections 70-73 of the Matrimonial Causes Act, Cap M7 LFN 2004.', type: 'finding' });
      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({ content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'the Petitioner'}:`, type: 'order' });
        divorceData.petitionerProperty.forEach(prop => { items.push({ content: `- ${prop}`, type: 'property_item' }); });
      }
      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({ content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'the Respondent'}:`, type: 'order' });
        divorceData.respondentProperty.forEach(prop => { items.push({ content: `- ${prop}`, type: 'property_item' }); });
      }
      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
        items.push({ content: 'IT IS ORDERED that each party retains the personal property currently in that party\'s possession, subject to any further ancillary order of this Court.', type: 'order' });
      }
    }
    return { title: 'ANCILLARY ORDERS — PROPERTY', items, type: 'property' };
  }

  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    const items = [];
    items.push({ content: 'The Court finds that the following order regarding the custody, welfare, and maintenance of the child(ren) is in the best interests of the child(ren) (Matrimonial Causes Act s.71; Child Rights Act 2003):', type: 'finding' });
    items.push({ content: 'The child(ren) subject to this order:', type: 'order' });
    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string' ? child : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '[BIRTH DATE]'}`;
      items.push({ content: `${index + 1}. ${childInfo}`, type: 'child_item' });
    });
    const custodyType = divorceData.custodyType || 'sole';
    if (custodyType === 'joint') {
      items.push({ content: `IT IS ORDERED that ${divorceData.petitionerName || 'the Petitioner'} and ${divorceData.respondentName || 'the Respondent'} shall have joint custody of the child(ren) of the marriage pursuant to section 71 of the Matrimonial Causes Act.`, type: 'order' });
    } else {
      items.push({ content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'the Petitioner'} shall have sole custody of the child(ren) of the marriage pursuant to section 71 of the Matrimonial Causes Act.`, type: 'order' });
      items.push({ content: `IT IS ORDERED that ${divorceData.respondentName || 'the Respondent'} shall have reasonable access to the child(ren) at such times and places as the parties may agree, or as this Court may direct.`, type: 'order' });
    }
    items.push({ content: 'IT IS ORDERED that neither party shall do anything to alienate the child(ren)\'s affection for the other party, and both parties shall facilitate the child(ren)\'s relationship with the other parent.', type: 'order' });
    return { title: 'CUSTODY OF CHILD(REN)', items, type: 'custody' };
  }

  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    const items = [];
    if (divorceData.childSupportAmount) {
      items.push({ content: `IT IS ORDERED pursuant to section 70 of the Matrimonial Causes Act that ${divorceData.childSupportObligor || divorceData.respondentName || 'the Respondent'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'the Petitioner'} the sum of NGN ${divorceData.childSupportAmount} per month for the maintenance of the child(ren) of the marriage.`, type: 'order' });
    } else {
      items.push({ content: 'IT IS ORDERED pursuant to section 70 of the Matrimonial Causes Act that the Respondent shall pay such sum as the Court deems reasonable for the maintenance of the child(ren) of the marriage.', type: 'order' });
    }
    return { title: 'CHILD MAINTENANCE', items, type: 'child_support' };
  }

  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) return null;
    const items = [];
    if (divorceData.spousalSupportWaived) {
      items.push({ content: 'The Court notes that neither party has applied for maintenance from the other under section 70 of the Matrimonial Causes Act.', type: 'order' });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({ content: `IT IS ORDERED pursuant to section 70 of the Matrimonial Causes Act that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'the Respondent'} shall pay maintenance to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'the Petitioner'} in the sum of NGN ${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`, type: 'order' });
    }
    return { title: 'SPOUSAL MAINTENANCE', items, type: 'spousal_support' };
  }

  generateFinalOrdersSection(divorceData) {
    const items = [];
    items.push({ content: 'IT IS HEREBY DECREED that the marriage between the Petitioner and the Respondent be and is hereby dissolved by this Decree Nisi.', type: 'order' });
    items.push({ content: 'IT IS ORDERED that all ancillary relief requested and not expressly granted is dismissed.', type: 'order' });
    items.push({ content: 'IT IS ORDERED that each party shall execute and deliver such further documents and do such further acts as may be necessary to give effect to the terms of this Decree.', type: 'order' });
    items.push({ content: this.getEffectiveDateText(), type: 'order' });
    items.push({ content: this.getCertificateNote(), type: 'order' });
    return { title: 'FINAL ORDERS', items, type: 'final_orders' };
  }

  getEffectiveDateText() {
    return 'This Decree Nisi shall become a Decree Absolute after the expiration of three months from the date hereof, unless cause is shown to the contrary or this Court otherwise directs (Matrimonial Causes Act, s.58). Where there are children of the marriage under sixteen years, the Decree Nisi shall not become absolute unless the Court has, by order, declared its satisfaction with the arrangements made for their welfare (Matrimonial Causes Act, s.57).';
  }

  getCertificateNote() {
    return 'Upon the expiration of the said three months, the Decree Nisi becomes absolute by force of section 58 of the Act; no application is required. A certified copy of the Decree Absolute may be obtained from the Court Registry.';
  }
}

module.exports = FCTDivorceDecreeTemplate;
