// templates/states/australian_capital_territory/DivorceDecreeTemplate.js
'use strict';
const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

class ACTDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();
    this.state = 'ACT'; this.stateName = 'Australian Capital Territory'; this.countryCode = 'AU'; this.documentTitle = 'DIVORCE ORDER';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'caseNumber', 'marriageDate'];
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '2.54cm', paperSize: 'A4' };
  }
  getCaseNumberLabel() { return 'File Number'; }
  getDefaultCourt() { return 'FEDERAL CIRCUIT AND FAMILY COURT OF AUSTRALIA (DIVISION 2) — CANBERRA REGISTRY'; }
  generateHeader() { return 'AUSTRALIAN CAPITAL TERRITORY'; }
  generateVenue() { return 'CANBERRA REGISTRY'; }
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt()).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[FILE NUMBER]';
    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted: `IN THE ${courtName}\n\n${this.getCaseNumberLabel()}: ${caseNumber}\n\nIN THE MATTER OF THE FAMILY LAW ACT 1975 (CTH)\n\nBETWEEN:\n\n${applicant}\nApplicant\n\n— and —\n\n${respondent}\nRespondent` };
  }
  generatePropertyDivisionSection(divorceData) {
    const items = [];
    if (divorceData.hasProperty === false) items.push({ content: 'No property to divide (s.79).', type: 'finding' });
    else { items.push({ content: 'The Court has considered property division pursuant to s.79.', type: 'finding' });
      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) items.push({ content: 'IT IS ORDERED that each party retains their current property.', type: 'order' }); }
    return { title: 'PROPERTY SETTLEMENT', items, type: 'property' };
  }
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    const items = [{ content: 'Parenting orders in the best interests of the child(ren) (s.60CA):', type: 'finding' }];
    const ct = divorceData.custodyType || 'joint';
    items.push({ content: ct === 'joint' ? 'IT IS ORDERED: shared parental responsibility.' : `IT IS ORDERED: ${divorceData.primaryCustodian || 'Applicant'} has sole parental responsibility.`, type: 'order' });
    return { title: 'PARENTING ORDERS', items, type: 'custody' };
  }
  getVisitationLanguage() { return 'IT IS ORDERED that each party shall facilitate the child(ren)\'s relationship with the other party.'; }
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    return { title: 'CHILD SUPPORT', items: [{ content: 'IT IS ORDERED that child support be assessed by Services Australia.', type: 'order' }], type: 'child_support' };
  }
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) return null;
    const items = [];
    if (divorceData.spousalSupportWaived) items.push({ content: 'IT IS ORDERED that each party releases claims for spousal maintenance.', type: 'order' });
    else if (divorceData.spousalSupportAwarded) items.push({ content: `IT IS ORDERED: spousal maintenance of $${divorceData.spousalSupportAmount || '[AMOUNT]'}/month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`, type: 'order' });
    return { title: 'SPOUSAL MAINTENANCE', items, type: 'spousal_support' };
  }
  generateFinalOrdersSection() {
    return { title: 'FINAL ORDERS', items: [
      { content: 'IT IS ORDERED that the marriage is dissolved.', type: 'order' },
      { content: 'IT IS ORDERED that all claims not granted are dismissed.', type: 'order' },
      { content: this.getEffectiveDateText(), type: 'order' },
      { content: this.getCertificateNote(), type: 'order' }
    ], type: 'final_orders' };
  }
  getEffectiveDateText() { return 'This Divorce Order takes effect one month and one day after made (s.55).'; }
  getCertificateNote() { return 'A sealed copy may be obtained from the Canberra registry after the order takes effect.'; }
}
module.exports = ACTDivorceDecreeTemplate;
