// templates/states/tamil_nadu/DivorceDecreeTemplate.js
'use strict';
const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

class TamilNaduDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();
    this.state = 'IN_TN'; this.stateName = 'Tamil Nadu'; this.countryCode = 'IN';
    this.documentTitle = 'DECREE OF DIVORCE';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'caseNumber', 'marriageDate'];
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '1in', paperSize: 'A4' };
  }
  getCaseNumberLabel() { return 'Case No.'; }
  getDefaultCourt() { return 'FAMILY COURT, CHENNAI'; }
  generateHeader() { return 'IN THE FAMILY COURT AT CHENNAI'; }
  generateVenue(county) { return (county || 'CHENNAI').toUpperCase(); }
  generateCaseCaption(dd) {
    const cn = (dd.court || this.getDefaultCourt()).toUpperCase(); const no = dd.caseNumber || '[CASE NUMBER]';
    const p = (dd.petitionerName || '[PETITIONER NAME]').toUpperCase(); const r = (dd.respondentName || '[RESPONDENT NAME]').toUpperCase();
    return { courtName: cn, caseNumber: dd.caseNumber, petitioner: dd.petitionerName, respondent: dd.respondentName, formatted: `IN THE ${cn}\n\nCase No. ${no}\n\nIN THE MATTER OF:\n\n${p}\nPetitioner\n\nVersus\n\n${r}\nRespondent` };
  }
  generatePropertyDivisionSection(dd) {
    const items = [];
    if (dd.hasProperty === false) items.push({ content: 'No matrimonial property to be divided.', type: 'finding' });
    else { items.push({ content: 'The Court has considered the settlement of property.', type: 'finding' }); if (!dd.petitionerProperty && !dd.respondentProperty) items.push({ content: 'Each party retains property in their possession.', type: 'order' }); }
    return { title: 'DIVISION OF PROPERTY', items, type: 'property' };
  }
  generateChildCustodySection(dd) {
    if (dd.hasMinorChildren === false || !dd.children?.length) return null;
    const items = [{ content: 'Custody ordered in the best interest of the child(ren):', type: 'finding' }];
    dd.children.forEach((c, i) => { const info = typeof c === 'string' ? c : `${c.name || '[NAME]'}, born ${this.formatDate(c.birthDate) || '[DOB]'}`; items.push({ content: `${i+1}. ${info}`, type: 'child_item' }); });
    if ((dd.custodyType || 'joint') === 'joint') items.push({ content: 'IT IS ORDERED that both parties have joint custody.', type: 'order' });
    else items.push({ content: `IT IS ORDERED that ${dd.primaryCustodian || dd.petitionerName || 'Petitioner'} has sole custody.`, type: 'order' });
    return { title: 'CUSTODY ORDER', items, type: 'custody' };
  }
  generateChildSupportSection(dd) {
    if (dd.hasMinorChildren === false || !dd.children?.length) return null;
    return { title: 'CHILD MAINTENANCE', items: [{ content: dd.childSupportAmount ? `IT IS ORDERED: INR ${dd.childSupportAmount}/month for child maintenance (HMA s.26 / BNSS s.144).` : 'IT IS ORDERED: child maintenance as Court deems fit.', type: 'order' }], type: 'child_support' };
  }
  generateSpousalSupportSection(dd) {
    if (!dd.spousalSupportAwarded && !dd.spousalSupportWaived) return null;
    const items = [];
    if (dd.spousalSupportWaived) items.push({ content: 'Neither party shall claim maintenance from the other.', type: 'order' });
    else items.push({ content: `IT IS ORDERED under HMA s.25: ${dd.spousalSupportPayor || 'Respondent'} pays INR ${dd.spousalSupportAmount || '[AMOUNT]'}/month for ${dd.spousalSupportDuration || '[DURATION]'}.`, type: 'order' });
    return { title: 'PERMANENT ALIMONY / MAINTENANCE', items, type: 'spousal_support' };
  }
  generateFinalOrdersSection() {
    return { title: 'FINAL ORDERS', items: [
      { content: 'IT IS HEREBY ORDERED AND DECREED that the marriage stands dissolved.', type: 'order' },
      { content: 'All relief not expressly granted is dismissed.', type: 'order' },
      { content: 'This Decree takes effect from the date it is passed.', type: 'order' },
      { content: 'Certified copy available from the court registry.', type: 'order' }
    ], type: 'final_orders' };
  }
  getEffectiveDateText() { return 'Decree takes effect from the date it is passed.'; }
  getCertificateNote() { return 'Certified copy from court registry.'; }
}
module.exports = TamilNaduDivorceDecreeTemplate;
