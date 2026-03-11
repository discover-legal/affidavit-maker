// templates/states/western_australia/DivorceDecreeTemplate.js
// NOTE: WA uses the Family Court of Western Australia (Family Court Act 1997 (WA))
'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

class WesternAustraliaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();
    this.state = 'WA_AU';
    this.stateName = 'Western Australia';
    this.countryCode = 'AU';
    this.documentTitle = 'DIVORCE ORDER';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'caseNumber', 'marriageDate'];
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '2.54cm', paperSize: 'A4' };
  }

  getCaseNumberLabel() { return 'File Number'; }
  getDefaultCourt() { return 'FAMILY COURT OF WESTERN AUSTRALIA'; }
  generateHeader() { return 'STATE OF WESTERN AUSTRALIA'; }
  generateVenue(county) { return `${(county || 'PERTH').toUpperCase()} REGISTRY`; }

  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt()).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[FILE NUMBER]';
    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    const formatted = `IN THE ${courtName}\n\n${this.getCaseNumberLabel()}: ${caseNumber}\n\nIN THE MATTER OF THE FAMILY LAW ACT 1975 (CTH)\nAND THE FAMILY COURT ACT 1997 (WA)\n\nBETWEEN:\n\n${applicant}\nApplicant\n\n— and —\n\n${respondent}\nRespondent`;
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted };
  }

  generatePropertyDivisionSection(divorceData) {
    const items = [];
    if (divorceData.hasProperty === false) {
      items.push({ content: 'The Court finds there is no property to be divided pursuant to section 79 of the Family Law Act 1975 (Cth).', type: 'finding' });
    } else {
      items.push({ content: 'The Court has considered the division of property pursuant to section 79 of the Family Law Act 1975 (Cth).', type: 'finding' });
      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({ content: `IT IS ORDERED that the following property is to vest in ${divorceData.petitionerName || 'Applicant'}:`, type: 'order' });
        divorceData.petitionerProperty.forEach(prop => items.push({ content: `- ${prop}`, type: 'property_item' }));
      }
      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({ content: `IT IS ORDERED that the following property is to vest in ${divorceData.respondentName || 'Respondent'}:`, type: 'order' });
        divorceData.respondentProperty.forEach(prop => items.push({ content: `- ${prop}`, type: 'property_item' }));
      }
      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
        items.push({ content: 'IT IS ORDERED that each party retains the property currently in that party\'s possession.', type: 'order' });
      }
    }
    return { title: 'PROPERTY SETTLEMENT', items, type: 'property' };
  }

  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    const items = [];
    items.push({ content: 'The Court finds that the following parenting orders are in the best interests of the child(ren) (s.60CA):', type: 'finding' });
    items.push({ content: 'The child(ren) subject to this order:', type: 'order' });
    divorceData.children.forEach((child, i) => {
      const info = typeof child === 'string' ? child : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate) || '[BIRTH DATE]'}`;
      items.push({ content: `${i + 1}. ${info}`, type: 'child_item' });
    });
    const custodyType = divorceData.custodyType || 'joint';
    if (custodyType === 'joint') {
      items.push({ content: `IT IS ORDERED that the parties shall have shared parental responsibility.`, type: 'order' });
    } else {
      items.push({ content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Applicant'} shall have sole parental responsibility.`, type: 'order' });
    }
    return { title: 'PARENTING ORDERS', items, type: 'custody' };
  }

  getVisitationLanguage() { return 'IT IS ORDERED that each party shall facilitate the child(ren)\'s relationship with the other party (s.60CC).'; }

  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    const items = [];
    items.push({ content: 'IT IS ORDERED that child support shall be assessed by Services Australia (Child Support) in accordance with the Child Support (Assessment) Act 1989 (Cth).', type: 'order' });
    return { title: 'CHILD SUPPORT', items, type: 'child_support' };
  }

  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) return null;
    const items = [];
    if (divorceData.spousalSupportWaived) {
      items.push({ content: 'IT IS ORDERED that each party releases any claim for spousal maintenance under sections 72-75 of the Family Law Act 1975 (Cth).', type: 'order' });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({ content: `IT IS ORDERED that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent'} shall pay spousal maintenance to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'Applicant'} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`, type: 'order' });
    }
    return { title: 'SPOUSAL MAINTENANCE', items, type: 'spousal_support' };
  }

  generateFinalOrdersSection(divorceData) {
    const items = [];
    items.push({ content: 'IT IS ORDERED that the marriage between the parties is dissolved.', type: 'order' });
    items.push({ content: 'IT IS ORDERED that all claims not expressly granted are dismissed.', type: 'order' });
    items.push({ content: this.getEffectiveDateText(), type: 'order' });
    items.push({ content: this.getCertificateNote(), type: 'order' });
    return { title: 'FINAL ORDERS', items, type: 'final_orders' };
  }

  getEffectiveDateText() { return 'This Divorce Order takes effect one month and one day after the date on which it is made (Family Law Act 1975 (Cth), s.55).'; }
  getCertificateNote() { return 'A sealed copy of this Divorce Order may be obtained from the Family Court of Western Australia registry after the order takes effect.'; }
}

module.exports = WesternAustraliaDivorceDecreeTemplate;
