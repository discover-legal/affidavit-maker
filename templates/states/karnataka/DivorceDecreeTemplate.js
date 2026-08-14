// templates/states/karnataka/DivorceDecreeTemplate.js
'use strict';
const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

class KarnatakaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();
    this.state = 'IN_KA'; this.stateName = 'Karnataka'; this.countryCode = 'IN';
    this.documentTitle = 'DECREE OF DIVORCE';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'caseNumber', 'marriageDate'];
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '1in', paperSize: 'A4' };
  }

  // Bengaluru Family Court dockets matrimonial cases as "M.C. No."
  getCaseNumberLabel() { return 'M.C. No.'; }
  // Prefer the filer's own district/city over the hardcoded default court
  getDefaultCourt(county) {
    const loc = county && String(county).trim();
    if (loc && loc.toUpperCase() !== 'BENGALURU') return `FAMILY COURT, ${loc.toUpperCase()}`;
    return 'FAMILY COURT, BENGALURU';
  }
  generateHeader(divorceData = {}) { return `IN THE ${(divorceData.court || this.getDefaultCourt(divorceData.county || divorceData.city)).toUpperCase()}`; }
  generateVenue(county) { return (county || 'BENGALURU').toUpperCase(); }

  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county || divorceData.city)).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted: `IN THE ${courtName}\n\n${this.getCaseNumberLabel()} ${caseNumber}\n\nIN THE MATTER OF:\n\n${petitioner}\nPetitioner\n\nVersus\n\n${respondent}\nRespondent` };
  }

  generatePropertyDivisionSection(divorceData) {
    const items = [];
    if (divorceData.hasProperty === false) { items.push({ content: 'The Court finds there is no matrimonial property to be divided.', type: 'finding' }); }
    else {
      items.push({ content: 'The Court has considered the settlement of property between the parties.', type: 'finding' });
      if (divorceData.petitionerProperty?.length > 0) { items.push({ content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Petitioner'}:`, type: 'order' }); divorceData.petitionerProperty.forEach(p => items.push({ content: `- ${p}`, type: 'property_item' })); }
      if (divorceData.respondentProperty?.length > 0) { items.push({ content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Respondent'}:`, type: 'order' }); divorceData.respondentProperty.forEach(p => items.push({ content: `- ${p}`, type: 'property_item' })); }
      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) items.push({ content: 'IT IS ORDERED that each party retains the property currently in their possession.', type: 'order' });
    }
    return { title: 'DIVISION OF PROPERTY', items, type: 'property' };
  }

  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    const items = [];
    items.push({ content: 'The Court orders the following custody arrangement in the best interest of the child(ren):', type: 'finding' });
    divorceData.children.forEach((child, i) => { const info = typeof child === 'string' ? child : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '[BIRTH DATE]'}`; items.push({ content: `${i + 1}. ${info}`, type: 'child_item' }); });
    const ct = divorceData.custodyType || 'joint';
    if (ct === 'joint') items.push({ content: 'IT IS ORDERED that both parties shall have joint custody of the child(ren).', type: 'order' });
    else { items.push({ content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have sole custody.`, type: 'order' }); items.push({ content: `IT IS ORDERED that ${divorceData.respondentName || 'Respondent'} shall have visitation rights.`, type: 'order' }); }
    return { title: 'CUSTODY ORDER', items, type: 'custody' };
  }

  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    const items = [];
    if (divorceData.childSupportAmount) items.push({ content: `IT IS ORDERED that ${divorceData.childSupportObligor || divorceData.respondentName || 'Respondent'} shall pay INR ${divorceData.childSupportAmount} per month for child maintenance (HMA s.26 / BNSS s.144).`, type: 'order' });
    else items.push({ content: 'IT IS ORDERED that child maintenance shall be paid as this Court deems fit (HMA s.26 / BNSS s.144).', type: 'order' });
    return { title: 'CHILD MAINTENANCE', items, type: 'child_support' };
  }

  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) return null;
    const items = [];
    if (divorceData.spousalSupportWaived) items.push({ content: 'IT IS ORDERED that neither party shall claim maintenance from the other.', type: 'order' });
    else items.push({ content: `IT IS ORDERED under HMA s.25 that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent'} shall pay INR ${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`, type: 'order' });
    return { title: 'PERMANENT ALIMONY / MAINTENANCE', items, type: 'spousal_support' };
  }

  generateFinalOrdersSection(divorceData) {
    return { title: 'FINAL ORDERS', items: [
      { content: 'IT IS HEREBY ORDERED AND DECREED that the marriage stands dissolved by a decree of divorce.', type: 'order' },
      { content: 'IT IS ORDERED that all relief not expressly granted herein is dismissed.', type: 'order' },
      { content: 'This Decree takes effect from the date it is passed.', type: 'order' },
      { content: 'A certified copy may be obtained from the court registry.', type: 'order' }
    ], type: 'final_orders' };
  }

  getEffectiveDateText() { return 'This Decree takes effect from the date it is passed.'; }
  getCertificateNote() { return 'A certified copy may be obtained from the court registry.'; }
}

module.exports = KarnatakaDivorceDecreeTemplate;
